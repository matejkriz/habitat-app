"use server";

import { getDbUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  UserRole,
  Presence,
  ExcuseStatus,
  type Child,
  type Attendance,
  type ExcuseDayPart,
} from "@/lib/types";
import { isClosedDay } from "@/lib/school-days";
import { recordBulkAttendance, canEnterAttendance } from "@/lib/attendance";
import { getExcusesOverlapping } from "@/lib/excuse";
import {
  getDayCoverage,
  getDayPartCoverage,
  getExcuseDayPartState,
  getExcuseStatusForDay,
  groupExcusesByChild,
  type ExcuseDayState,
} from "@/lib/excuse-coverage";
import { revalidatePath } from "next/cache";

type AttendanceRecord = {
  readonly childId: string;
  readonly presence: Presence;
  readonly excuseStatus: ExcuseStatus;
};

type DailyExcuse = {
  readonly childId: string;
  readonly state: ExcuseDayState;
  readonly lunchCancelled: boolean;
  readonly dayPart: ExcuseDayPart;
};

type DailyAttendance = {
  readonly isClosed: boolean;
  readonly attendance: ReadonlyArray<AttendanceRecord>;
  readonly excuses: ReadonlyArray<DailyExcuse>;
  readonly noLunch: boolean;
  readonly canManageLunch: boolean;
};

/**
 * Get all active children for attendance entry
 */
export const getAllChildren = async (): Promise<ReadonlyArray<Child>> => {
  const user = await getDbUser();
  if (!user || (user.role !== UserRole.TEACHER && user.role !== UserRole.DIRECTOR)) {
    throw new Error("Unauthorized");
  }

  const children = (await db.children.list({
    where: { active: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  })) as ReadonlyArray<Child>;

  return children;
};

/**
 * Get attendance for a specific date
 */
export const getAttendanceForDate = async (
  dateStr: string,
): Promise<DailyAttendance> => {
  const user = await getDbUser();
  if (!user || (user.role !== UserRole.TEACHER && user.role !== UserRole.DIRECTOR)) {
    throw new Error("Unauthorized");
  }

  const date = new Date(dateStr);
  date.setHours(0, 0, 0, 0);

  const closed = await isClosedDay(date);
  if (closed) {
    return {
      isClosed: true,
      attendance: [],
      excuses: [],
      noLunch: false,
      canManageLunch: user.role === UserRole.DIRECTOR,
    };
  }

  const [attendance, excuses, noLunchDay] = await Promise.all([
    db.attendance.list({
      where: { date },
      include: {
        child: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    }) as Promise<ReadonlyArray<Attendance>>,
    getExcusesOverlapping({ from: date, to: date }),
    db.noLunchDays.get({ where: { date } }),
  ]);

  const excusesByChild = groupExcusesByChild(excuses);
  const coverageFor = (childId: string) =>
    getDayCoverage(excusesByChild.get(childId) ?? [], date);

  return {
    isClosed: false,
    attendance: attendance.map((a) => ({
      childId: a.childId,
      presence: a.presence,
      excuseStatus: getExcuseStatusForDay(a.presence, coverageFor(a.childId)),
    })),
    excuses: [...excusesByChild.keys()].map((childId) => {
      const childExcuses = excusesByChild.get(childId) ?? [];
      const coverage = getDayCoverage(childExcuses, date);
      const morning = getDayPartCoverage(childExcuses, date, "MORNING");
      const afternoon = getDayPartCoverage(childExcuses, date, "AFTERNOON");
      const morningState = getExcuseDayPartState(
        childExcuses,
        date,
        "MORNING",
      );
      const afternoonState = getExcuseDayPartState(
        childExcuses,
        date,
        "AFTERNOON",
      );
      const dayPart =
        morning.covered && afternoon.covered
          ? "FULL_DAY"
          : morning.covered
            ? "MORNING"
            : "AFTERNOON";
      const applicableStates =
        dayPart === "MORNING"
          ? [morningState]
          : dayPart === "AFTERNOON"
            ? [afternoonState]
            : [morningState, afternoonState];
      const state = applicableStates.includes("LATE")
        ? "LATE"
        : applicableStates.includes("LATE_APPROVED")
          ? "LATE_APPROVED"
          : "ON_TIME";
      return {
        childId,
        dayPart,
        state,
        lunchCancelled:
          coverage.lunchCancelled ||
          morning.lunchCancelled ||
          afternoon.lunchCancelled,
      };
    }),
    noLunch: noLunchDay !== null,
    canManageLunch: user.role === UserRole.DIRECTOR,
  };
};

export const setNoLunchForDate = async (
  dateStr: string,
  noLunch: boolean,
): Promise<{ readonly noLunch: boolean }> => {
  const user = await getDbUser();
  if (!user || user.role !== UserRole.DIRECTOR) {
    throw new Error("Unauthorized");
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(Number.NaN);
  if (
    !match ||
    date.getFullYear() !== Number(match[1]) ||
    date.getMonth() !== Number(match[2]) - 1 ||
    date.getDate() !== Number(match[3])
  ) {
    throw new Error("Neplatné datum");
  }

  if (await isClosedDay(date)) {
    throw new Error("V zavřený den se oběd neeviduje");
  }

  const savedNoLunch = await db.noLunchDays.set({
    date,
    noLunch,
    recordedById: user.id,
  });

  await db.auditLogs.create({
    data: {
      userId: user.id,
      action: "UPDATE",
      entityType: "LunchDay",
      entityId: dateStr,
      newValue: { noLunch: savedNoLunch },
    },
  });

  revalidatePath("/ucitel/dochazka");
  revalidatePath("/kalendar");
  revalidatePath("/reditel/obedy");

  return { noLunch: savedNoLunch };
};

/**
 * Check if a date is a closed day
 */
export const checkDateClosed = async (dateStr: string): Promise<boolean> => {
  const date = new Date(dateStr);
  return isClosedDay(date);
};

/**
 * Save attendance for all children on a specific date
 */
export const saveAttendance = async (
  formData: FormData,
): Promise<{ readonly success: true; readonly recordCount: number }> => {
  const user = await getDbUser();
  if (!user || (user.role !== UserRole.TEACHER && user.role !== UserRole.DIRECTOR)) {
    throw new Error("Unauthorized");
  }

  const dateStr = formData.get("date") as string;
  const date = new Date(dateStr);
  date.setHours(0, 0, 0, 0);

  // Check if we can enter attendance for this date
  const canEnter = await canEnterAttendance(date);
  if (!canEnter) {
    throw new Error("Nelze zaznamenat docházku pro tento den");
  }

  // Parse attendance data
  const records: Array<{ childId: string; presence: Presence }> = [];

  for (const [key, value] of formData.entries()) {
    if (key.startsWith("child-")) {
      const childId = key.replace("child-", "");
      records.push({
        childId,
        presence: value === "present" ? Presence.PRESENT : Presence.ABSENT,
      });
    }
  }

  // Save all attendance records
  await recordBulkAttendance(records, date, user.id);

  // Create audit log
  await db.auditLogs.create({
    data: {
      userId: user.id,
      action: "CREATE",
      entityType: "Attendance",
      entityId: `bulk-${dateStr}`,
      newValue: {
        date: dateStr,
        recordCount: records.length,
        presentCount: records.filter((r) => r.presence === Presence.PRESENT).length,
      },
    },
  });

  revalidatePath("/ucitel/dochazka");
  revalidatePath("/kalendar");
  revalidatePath("/reditel/obedy");
  revalidatePath("/rodic");

  return { success: true, recordCount: records.length };
};
