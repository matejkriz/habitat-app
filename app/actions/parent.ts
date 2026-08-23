"use server";

import { getDbUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  UserRole,
  Presence,
  ExcuseStatus,
  type Attendance,
  type Child,
  type ClosedDay,
  type Excuse,
} from "@/lib/types";
import { isClosedDay } from "@/lib/school-days";
import {
  createExcuse,
  canManageExcuse,
  canManageExcuses,
  canSubmitExcuse,
  deleteExcuse as deleteExcuseRecord,
  updateExcuse as updateExcuseRecord,
} from "@/lib/excuse";
import { parseExcuseDate, resolveExcuseChildIds } from "@/lib/excuse-rules";
import { buildParentCalendarMonth, parseMonth } from "@/lib/parent-calendar";
import { revalidatePath } from "next/cache";

type ParentChildWithChild = {
  readonly child: Child;
};

type ChildTodayStatus = {
  readonly date: Date;
  readonly isSchoolDay: boolean;
  readonly isClosed: boolean;
  readonly attendance: {
    readonly presence: Presence;
    readonly excuseStatus: ExcuseStatus;
  } | null;
};

type AttendanceWithOptionalExcuse = Attendance & {
  readonly excuse?: {
    readonly id: string;
    readonly reason: string | null;
    readonly autoApproved: boolean;
  } | null;
};

type AttendanceHistoryItem = {
  readonly id: string;
  readonly date: Date;
  readonly presence: Presence;
  readonly excuseStatus: ExcuseStatus;
  readonly excuse: AttendanceWithOptionalExcuse["excuse"];
};

type ChildExcuseItem = {
  readonly id: string;
  readonly fromDate: Date;
  readonly toDate: Date;
  readonly reason: string | null;
  readonly autoApproved: boolean;
  readonly submittedAt: Date;
};

/**
 * Get children for the current parent
 */
export const getParentChildren = async (): Promise<ReadonlyArray<Child>> => {
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

  return parentChildren.map((pc) => pc.child);
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

  const attendance = (await db.attendance.get({
    where: {
      childId_date: {
        childId,
        date: today,
      },
    },
  })) as Attendance | null;

  return {
    date: today,
    isSchoolDay: true,
    isClosed: false,
    attendance: attendance
      ? {
          presence: attendance.presence,
          excuseStatus: attendance.excuseStatus,
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

  const attendance = (await db.attendance.list({
    where: {
      childId,
      date: {
        gte: startDate,
        lte: today,
      },
    },
    orderBy: { date: "desc" },
    include: {
      excuse: {
        select: {
          id: true,
          reason: true,
          autoApproved: true,
        },
      },
    },
  })) as ReadonlyArray<AttendanceWithOptionalExcuse>;

  return attendance.map((a) => ({
    id: a.id,
    date: a.date,
    presence: a.presence,
    excuseStatus: a.excuseStatus,
    excuse: a.excuse,
  }));
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
    fromDate: e.fromDate,
    toDate: e.toDate,
    reason: e.reason,
    autoApproved: e.autoApproved,
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

  const [attendance, allExcuses, closedDays] = (await Promise.all([
    db.attendance.list({
      where: { childId, date: { gte: monthStart, lte: monthEnd } },
    }),
    db.excuses.list({ where: { childId } }),
    db.closedDays.list({
      where: { date: { gte: monthStart, lte: monthEnd } },
    }),
  ])) as [ReadonlyArray<Attendance>, ReadonlyArray<Excuse>, ReadonlyArray<ClosedDay>];

  const overlappingExcuses = allExcuses.filter(
    (excuse) => excuse.fromDate <= monthEnd && excuse.toDate >= monthStart,
  );

  return buildParentCalendarMonth({
    month: monthStart,
    attendance,
    excuses: overlappingExcuses,
    closedDays: closedDays.map((day) => day.date),
  });
};

/**
 * Submit a new excuse for a child
 */
export const submitExcuse = async (formData: FormData) => {
  const user = await getDbUser();
  if (!user || user.role !== UserRole.PARENT) {
    throw new Error("Unauthorized");
  }

  const fallbackChildId = formData.get("childId");
  const fromDateStr = formData.get("fromDate");
  const toDateStr = formData.get("toDate");
  const reasonValue = formData.get("reason");

  if (
    typeof fallbackChildId !== "string" ||
    typeof fromDateStr !== "string" ||
    typeof toDateStr !== "string"
  ) {
    throw new Error("Missing required fields");
  }

  const requestedChildIds = formData
    .getAll("childIds")
    .filter((value): value is string => typeof value === "string");
  const childIds = resolveExcuseChildIds(requestedChildIds, fallbackChildId);

  if (!(await canManageExcuses(user, childIds))) {
    throw new Error("Access denied");
  }

  const fromDate = parseExcuseDate(fromDateStr);
  const toDate = parseExcuseDate(toDateStr);
  const reason = typeof reasonValue === "string" ? reasonValue.trim() || null : null;

  const excuses = await Promise.all(
    childIds.map((childId) =>
      createExcuse(childId, fromDate, toDate, reason, user.id),
    ),
  );

  revalidatePath("/rodic");
  revalidatePath("/rodic/omluvenka");
  revalidatePath("/kalendar");

  return {
    success: true,
    excuses: excuses.map((excuse) => ({
      id: excuse.id,
      childId: excuse.childId,
      fromDate: excuse.fromDate,
      toDate: excuse.toDate,
      autoApproved: excuse.autoApproved,
    })),
  };
};

type ExcuseEditInput = {
  readonly fromDate: string;
  readonly toDate: string;
  readonly reason: string;
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

  const updated = await updateExcuseRecord(
    excuseId,
    {
      fromDate: parseExcuseDate(input.fromDate),
      toDate: parseExcuseDate(input.toDate),
      reason: input.reason.trim() || null,
    },
    user.id,
  );

  revalidatePath("/rodic");
  return updated;
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

  const attendance = (await db.attendance.list({
    where: {
      childId,
      date: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
  })) as ReadonlyArray<Attendance>;

  const stats = {
    totalRecords: attendance.length,
    present: attendance.filter((a) => a.presence === Presence.PRESENT).length,
    absent: attendance.filter((a) => a.presence === Presence.ABSENT).length,
    excused: attendance.filter(
      (a) => a.presence === Presence.ABSENT && a.excuseStatus === ExcuseStatus.EXCUSED
    ).length,
    unexcused: attendance.filter(
      (a) => a.presence === Presence.ABSENT && a.excuseStatus === ExcuseStatus.UNEXCUSED
    ).length,
  };

  return stats;
};
