"use server";

import { getAttendanceDays, getChildDayPlan, hasPartialAttendance, isRegularAttendanceDay } from "@/lib/attendance-schedule";
import type { DaySummary } from "@/lib/day-details";
import { randomUUID } from "node:crypto";
import { getDbUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  UserRole,
  Presence,
  ExcuseStatus,
  type Attendance,
  type Child,
  type ChildGender,
  type ClosedDay,
  type Excuse,
  type ExcuseDayPart,
} from "@/lib/types";
import { getSchoolDaysInRange, isClosedDay } from "@/lib/school-days";
import {
  createParentExcuses,
  canManageExcuse,
  canManageExcuses,
  canSubmitExcuse,
  deleteExcuse as deleteExcuseRecord,
  getExcusesOverlapping,
  updateExcuse as updateExcuseRecord,
} from "@/lib/excuse";
import {
  getExcuseDayPartForRange,
  parseCancelLunchChoice,
  parseExcuseDayPart,
} from "@/lib/excuse-input";
import {
  getDayCoverage,
  getExcuseStatusForDay,
  getLateDays,
} from "@/lib/excuse-coverage";
import {
  areExcuseEndpointsOpen,
  CLOSED_EXCUSE_ENDPOINT_ERROR,
  ExcuseValidationError,
  parseExcuseDate,
  resolveExcuseChildIds,
  validateExcuseDates,
} from "@/lib/excuse-rules";
import { buildParentCalendarMonth, parseMonth } from "@/lib/parent-calendar";
import { revalidatePath } from "next/cache";

type ParentChildWithChild = {
  readonly child: Child;
};

export type ParentVisibleChild = {
  readonly attendanceDays?: ReadonlyArray<number>;
  readonly id: string;
  readonly firstName: string;
  readonly gender: ChildGender | null;
  readonly doesNotTakeLunch: boolean;
};

type ChildTodayStatus = {
  readonly notScheduled?: boolean;
  readonly makeup?: boolean;
  readonly date: Date;
  readonly isSchoolDay: boolean;
  readonly isClosed: boolean;
  readonly attendance: {
    readonly presence: Presence;
    readonly excuseStatus: ExcuseStatus;
  } | null;
};

type AttendanceHistoryItem = {
  readonly id: string;
  readonly date: Date;
  readonly presence: Presence;
  readonly excuseStatus: ExcuseStatus;
  readonly excuse: { readonly id: string; readonly reason: string | null } | null;
};

type ChildExcuseItem = {
  readonly kind?: "EXCUSE" | "MAKEUP";
  readonly id: string;
  readonly fromDate: Date;
  readonly toDate: Date;
  readonly reason: string | null;
  readonly dayPart: ExcuseDayPart;
  readonly cancelLunch: boolean;
  readonly submittedAt: Date;
};

/**
 * Get children for the current parent
 */
export const getParentChildren = async (): Promise<
  ReadonlyArray<ParentVisibleChild>
> => {
  const user = await getDbUser();
  if (!user || user.role !== UserRole.PARENT) {
    throw new Error("Unauthorized");
  }

  const parentChildren = (await db.parentLinks.list({
    where: { parentId: user.id },
    include: {
      child: true,
    },
  })) as ReadonlyArray<ParentChildWithChild>;

  return parentChildren.map(({ child }) => ({
    id: child.id,
    firstName: child.firstName,
    gender: child.gender,
    doesNotTakeLunch: child.doesNotTakeLunch,
    attendanceDays: [...getAttendanceDays(child)],
  }));
};

/**
 * Get today's status for a child
 */
export const getChildTodayStatus = async (
  childId: string,
): Promise<ChildTodayStatus> => {
  const user = await getDbUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  // Verify parent has access to this child
  if (user.role === UserRole.PARENT) {
    const hasAccess = await canSubmitExcuse(user.id, childId);
    if (!hasAccess) {
      throw new Error("Access denied");
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const closed = await isClosedDay(today);

  if (closed) {
    return {
      date: today,
      isSchoolDay: false,
      isClosed: true,
      attendance: null,
    };
  }

  const [attendance, excuses, child] = await Promise.all([
    db.attendance.get({
      where: {
        childId_date: {
          childId,
          date: today,
        },
      },
    }) as Promise<Attendance | null>,
    getExcusesOverlapping({ childId, from: today, to: today }),
    db.children.get({ where: { id: childId } }) as Promise<Child | null>,
  ]);

  return {
    date: today,
    isSchoolDay: true,
    isClosed: false,
    notScheduled: getChildDayPlan(child ?? {}, excuses, today).notScheduled,
    makeup: getChildDayPlan(child ?? {}, excuses, today).makeup,
    attendance: attendance
      ? {
          presence: attendance.presence,
          excuseStatus: getExcuseStatusForDay(
            attendance.presence,
            getDayCoverage(excuses, today),
          ),
        }
      : null,
  };
};

/**
 * Get attendance history for a child
 */
export const getChildAttendanceHistory = async (
  childId: string,
  limit = 14,
): Promise<ReadonlyArray<AttendanceHistoryItem>> => {
  const user = await getDbUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  // Verify parent has access to this child
  if (user.role === UserRole.PARENT) {
    const hasAccess = await canSubmitExcuse(user.id, childId);
    if (!hasAccess) {
      throw new Error("Access denied");
    }
  }

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - limit);
  startDate.setHours(0, 0, 0, 0);

  const [attendance, excuses, child] = await Promise.all([
    db.attendance.list({
      where: {
        childId,
        date: {
          gte: startDate,
          lte: today,
        },
      },
      orderBy: { date: "desc" },
    }) as Promise<ReadonlyArray<Attendance>>,
    getExcusesOverlapping({ childId, from: startDate, to: today }),
    db.children.get({ where: { id: childId } }) as Promise<Child | null>,
  ]);

  return attendance.map((a) => {
    const coverage = getDayCoverage(excuses, a.date);

    return {
      id: a.id,
      date: a.date,
      presence: a.presence,
      excuseStatus: a.presence === Presence.ABSENT && getChildDayPlan(child ?? {}, excuses, a.date).notScheduled
        ? ExcuseStatus.EXCUSED
        : getExcuseStatusForDay(a.presence, coverage),
      excuse: coverage.excuse
        ? { id: coverage.excuse.id, reason: coverage.excuse.reason ?? null }
        : null,
    };
  });
};

/**
 * Get excuses for a child
 */
export const getChildExcuses = async (
  childId: string,
  limit = 10,
): Promise<ReadonlyArray<ChildExcuseItem>> => {
  const user = await getDbUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  // Verify parent has access to this child
  if (user.role === UserRole.PARENT) {
    const hasAccess = await canSubmitExcuse(user.id, childId);
    if (!hasAccess) {
      throw new Error("Access denied");
    }
  }

  const excuses = (await db.excuses.list({
    where: { childId },
    orderBy: { submittedAt: "desc" },
    take: limit,
  })) as ReadonlyArray<Excuse>;

  return excuses.map((e) => ({
    id: e.id,
    kind: e.kind ?? "EXCUSE",
    fromDate: e.fromDate,
    toDate: e.toDate,
    reason: e.reason,
    dayPart: e.dayPart,
    cancelLunch: e.cancelLunch,
    submittedAt: e.submittedAt,
  }));
};

/**
 * Get one calendar month with attendance, excuse and closure states.
 */
export const getChildCalendarMonth = async (childId: string, month: string) => {
  const user = await getDbUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  if (user.role === UserRole.PARENT) {
    const hasAccess = await canSubmitExcuse(user.id, childId);
    if (!hasAccess) {
      throw new Error("Access denied");
    }
  }

  const monthStart = parseMonth(month);
  const monthEnd = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );

  const [attendance, excuses, closedDays, dayDetails, child] = await Promise.all([
    db.attendance.list({
      where: { childId, date: { gte: monthStart, lte: monthEnd } },
    }) as Promise<ReadonlyArray<Attendance>>,
    getExcusesOverlapping({ childId, from: monthStart, to: monthEnd }),
    db.closedDays.list({
      where: { date: { gte: monthStart, lte: monthEnd } },
    }) as Promise<ReadonlyArray<ClosedDay>>,
    db.dayDetails.list(monthStart, monthEnd) as Promise<DaySummary[]>,
    db.children.get({ where: { id: childId } }) as Promise<Child | null>,
  ]);

  const namesByDate = new Map(dayDetails.map(day => [day.date, day.name]));
  return buildParentCalendarMonth({
    month: monthStart,
    attendanceDays: child?.attendanceDays,
    attendance,
    excuses,
    closedDays: closedDays.map((day) => day.date),
  }).map(day => ({
    ...day,
    name: namesByDate.get(new Date(monthStart.getFullYear(), monthStart.getMonth(), day.dayNumber).getTime()) ?? null,
  }));
};

/**
 * Submit a new excuse for a child
 */
export const submitExcuse = async (formData: FormData) => submitParentRecord(formData, "EXCUSE");

export const submitMakeup = async (formData: FormData) => submitParentRecord(formData, "MAKEUP");

async function submitParentRecord(formData: FormData, kind: "EXCUSE" | "MAKEUP") {
  try {
    return await createParentRecord(formData, kind);
  } catch (error) {
    if (error instanceof ExcuseValidationError) {
      return { success: false as const, error: error.message };
    }
    throw error;
  }
}

async function createParentRecord(formData: FormData, kind: "EXCUSE" | "MAKEUP") {
  const user = await getDbUser();
  if (!user || user.role !== UserRole.PARENT) {
    throw new Error("Unauthorized");
  }

  const fromDateStr = formData.get("fromDate");
  const toDateStr = formData.get("toDate");
  const reasonValue = formData.get("reason");
  const requestedDayPart = parseExcuseDayPart(formData.get("dayPart"));
  const cancelLunch = kind === "MAKEUP" ? false : parseCancelLunchChoice(formData.get("cancelLunch"));

  if (
    typeof fromDateStr !== "string" ||
    typeof toDateStr !== "string"
  ) {
    throw new ExcuseValidationError("Zadejte datum začátku a konce.");
  }

  const requestedChildIds = formData
    .getAll("childIds")
    .filter((value): value is string => typeof value === "string");
  const childIds = resolveExcuseChildIds(requestedChildIds);

  if (!(await canManageExcuses(user, childIds))) {
    throw new Error("Access denied");
  }

  const fromDate = parseExcuseDate(fromDateStr);
  const toDate = parseExcuseDate(toDateStr);
  const validation = validateExcuseDates(fromDate, toDate);
  if (!validation.valid) {
    throw new ExcuseValidationError(validation.error);
  }
  const dayPart = getExcuseDayPartForRange(
    requestedDayPart,
    fromDate,
    toDate,
  );
  const reason = typeof reasonValue === "string" ? reasonValue.trim() || null : null;
  const schoolDays = await getSchoolDaysInRange(fromDate, toDate);
  if (!areExcuseEndpointsOpen(fromDate, toDate, schoolDays)) {
    throw new ExcuseValidationError(kind === "MAKEUP" ? "Začátek i konec náhrady musí být v den, kdy je Habitat otevřený." : CLOSED_EXCUSE_ENDPOINT_ERROR);
  }

  const makeupChildren: Child[] = [];
  if (kind === "MAKEUP") {
    const links = await db.parentLinks.list({ where: { parentId: user.id }, include: { child: true } }) as ParentChildWithChild[];
    for (const childId of childIds) {
      const child = links.find(link => link.child.id === childId)?.child;
      if (!child?.active || !hasPartialAttendance(child)) {
        throw new ExcuseValidationError("Náhradu lze zadat pouze dítěti, které nechodí každý den.");
      }
      if (!schoolDays.some(day => !isRegularAttendanceDay(child, day))) {
        throw new ExcuseValidationError("Vyberte alespoň jeden den, kdy dítě pravidelně nechodí.");
      }
      makeupChildren.push(child);
    }
  }
  const requestId = formData.get("requestId");
  const excuses = await createParentExcuses({
    parentId: user.id,
    // Compatibility with forms opened before the new version was deployed.
    requestId: typeof requestId === "string" ? requestId : randomUUID(),
    childIds, fromDate, toDate, reason, cancelLunch, dayPart,
    ...(kind === "MAKEUP" ? { kind } : {}),
  }, schoolDays);
  const daysForRecord = (excuse: Excuse) => kind === "MAKEUP"
    ? schoolDays.filter(day => !isRegularAttendanceDay(makeupChildren.find(child => child.id === excuse.childId)!, day))
    : schoolDays;
  const schoolDayCount = excuses.reduce((count, excuse) => count + daysForRecord(excuse).length, 0);
  const automaticallyApprovedDayCount = excuses.reduce((count, excuse) => {
    if (kind === "MAKEUP") {
      const child = makeupChildren.find(child => child.id === excuse.childId);
      return count + (child?.doesNotTakeLunch || dayPart === "AFTERNOON" ? daysForRecord(excuse).length : 0);
    }
    return count + (excuse.lateApprovedAt === null ? 0 : schoolDays.length);
  }, 0);
  const lateDayCount = excuses.reduce((count, excuse) => {
    const child = makeupChildren.find(child => child.id === excuse.childId);
    if (excuse.lateApprovedAt !== null || (kind === "MAKEUP" && (child?.doesNotTakeLunch || dayPart === "AFTERNOON"))) return count;
    return count + getLateDays(excuse, daysForRecord(excuse)).length;
  }, 0);

  revalidatePath("/rodic");
  revalidatePath("/rodic/omluvenka");
  revalidatePath("/reditel/obedy");
  revalidatePath("/reditel/omluvenky");
  revalidatePath("/kalendar");
  revalidatePath("/ucitel/dochazka");
  revalidatePath("/reditel");
  revalidatePath("/");

  return {
    success: true as const,
    excuses: excuses.map((excuse) => ({
      id: excuse.id,
      childId: excuse.childId,
      fromDate: excuse.fromDate,
      toDate: excuse.toDate,
    })),
    summary: {
      cancelLunch,
      schoolDayCount,
      lateDayCount,
      onTimeDayCount:
        schoolDayCount - lateDayCount - automaticallyApprovedDayCount,
      automaticallyApprovedDayCount,
    },
  };
};

type ExcuseEditInput = {
  readonly fromDate: string;
  readonly toDate: string;
  readonly reason: string;
  readonly dayPart?: string;
};

export const editParentExcuse = async (
  excuseId: string,
  input: ExcuseEditInput,
) => {
  const user = await getDbUser();
  if (!user || user.role !== UserRole.PARENT) {
    throw new Error("Unauthorized");
  }

  const excuse = await db.excuses.get({ where: { id: excuseId } });
  if (!excuse) {
    throw new Error("Omluvenka nebyla nalezena.");
  }

  if (!(await canManageExcuse(user, excuse.childId))) {
    throw new Error("Access denied");
  }

  let updated: Excuse;
  try {
    updated = await updateExcuseRecord(
      excuseId,
      {
        fromDate: parseExcuseDate(input.fromDate),
        toDate: parseExcuseDate(input.toDate),
        reason: input.reason.trim() || null,
        dayPart:
          input.dayPart === undefined
            ? undefined
            : parseExcuseDayPart(input.dayPart),
      },
      user.id,
    );
  } catch (error) {
    if (error instanceof ExcuseValidationError) {
      return { success: false as const, error: error.message };
    }
    throw error;
  }

  revalidatePath("/rodic");
  revalidatePath("/kalendar");
  revalidatePath("/ucitel/dochazka");
  revalidatePath("/reditel");
  revalidatePath("/");
  return { success: true as const, excuse: updated };
};

export const deleteParentExcuse = async (excuseId: string): Promise<void> => {
  const user = await getDbUser();
  if (!user || user.role !== UserRole.PARENT) {
    throw new Error("Unauthorized");
  }

  const excuse = await db.excuses.get({ where: { id: excuseId } });
  if (!excuse) {
    throw new Error("Omluvenka nebyla nalezena.");
  }

  if (!(await canManageExcuse(user, excuse.childId))) {
    throw new Error("Access denied");
  }

  await deleteExcuseRecord(excuseId, user.id);
  revalidatePath("/rodic");
  revalidatePath("/kalendar");
  revalidatePath("/ucitel/dochazka");
  revalidatePath("/reditel");
  revalidatePath("/");
};

/**
 * Get attendance statistics for a child
 */
export const getChildStats = async (
  childId: string,
): Promise<{
  readonly totalRecords: number;
  readonly present: number;
  readonly absent: number;
  readonly excused: number;
  readonly unexcused: number;
}> => {
  const user = await getDbUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  // Verify parent has access to this child
  if (user.role === UserRole.PARENT) {
    const hasAccess = await canSubmitExcuse(user.id, childId);
    if (!hasAccess) {
      throw new Error("Access denied");
    }
  }

  // Get stats for current month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [attendance, excuses, child] = await Promise.all([
    db.attendance.list({
      where: {
        childId,
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    }) as Promise<ReadonlyArray<Attendance>>,
    getExcusesOverlapping({ childId, from: startOfMonth, to: endOfMonth }),
    db.children.get({ where: { id: childId } }) as Promise<Child | null>,
  ]);

  const absences = attendance
    .filter((a) => a.presence === Presence.ABSENT)
    .map((a) => getChildDayPlan(child ?? {}, excuses, a.date).notScheduled || getDayCoverage(excuses, a.date).excused);
  const excused = absences.filter(Boolean).length;

  return {
    totalRecords: attendance.length,
    present: attendance.filter((a) => a.presence === Presence.PRESENT).length,
    absent: absences.length,
    excused,
    unexcused: absences.length - excused,
  };
};
