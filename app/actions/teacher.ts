"use server";

import { getDbUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  UserRole,
  Presence,
  ExcuseStatus,
  type Child,
  type Attendance,
  type Excuse,
} from "@/lib/types";
import { isClosedDay } from "@/lib/school-days";
import { recordBulkAttendance, canEnterAttendance } from "@/lib/attendance";
import { revalidatePath } from "next/cache";

type AttendanceRecord = {
  readonly childId: string;
  readonly presence: Presence;
  readonly excuseStatus: ExcuseStatus;
};

type DailyExcuse = {
  readonly childId: string;
  readonly isOnTime: boolean;
};

type DailyAttendance = {
  readonly isClosed: boolean;
  readonly attendance: ReadonlyArray<AttendanceRecord>;
  readonly excuses: ReadonlyArray<DailyExcuse>;
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
    return { isClosed: true, attendance: [], excuses: [] };
  }

  const [attendance, possibleExcuses] = await Promise.all([
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
    db.excuses.list({
      where: { fromDate: { lte: date } },
      orderBy: { submittedAt: "desc" },
    }) as Promise<ReadonlyArray<Excuse>>,
  ]);

  const excusesByChild = new Map<string, DailyExcuse>();
  for (const excuse of possibleExcuses) {
    if (excuse.toDate < date || excusesByChild.has(excuse.childId)) continue;
    excusesByChild.set(excuse.childId, {
      childId: excuse.childId,
      isOnTime: excuse.autoApproved,
    });
  }

  return {
    isClosed: false,
    attendance: attendance.map((a) => ({
      childId: a.childId,
      presence: a.presence,
      excuseStatus: a.excuseStatus,
    })),
    excuses: [...excusesByChild.values()],
  };
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
  revalidatePath("/rodic");

  return { success: true, recordCount: records.length };
};
