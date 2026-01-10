"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserRole, Presence, ExcuseStatus } from "@prisma/client";
import { isClosedDay } from "@/lib/school-days";
import { createExcuse, canSubmitExcuse } from "@/lib/excuse";
import { revalidatePath } from "next/cache";

/**
 * Get children for the current parent
 */
export async function getParentChildren() {
  const session = await auth();
  if (!session?.user || session.user.role !== UserRole.PARENT) {
    throw new Error("Unauthorized");
  }

  const parentChildren = await prisma.parentChild.findMany({
    where: { parentId: session.user.id },
    include: {
      child: true,
    },
  });

  return parentChildren.map((pc) => pc.child);
}

/**
 * Get today's status for a child
 */
export async function getChildTodayStatus(childId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  // Verify parent has access to this child
  if (session.user.role === UserRole.PARENT) {
    const hasAccess = await canSubmitExcuse(session.user.id, childId);
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

  const attendance = await prisma.attendance.findUnique({
    where: {
      childId_date: {
        childId,
        date: today,
      },
    },
  });

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
}

/**
 * Get attendance history for a child
 */
export async function getChildAttendanceHistory(
  childId: string,
  limit = 14
) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  // Verify parent has access to this child
  if (session.user.role === UserRole.PARENT) {
    const hasAccess = await canSubmitExcuse(session.user.id, childId);
    if (!hasAccess) {
      throw new Error("Access denied");
    }
  }

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - limit);
  startDate.setHours(0, 0, 0, 0);

  const attendance = await prisma.attendance.findMany({
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
  });

  return attendance.map((a) => ({
    id: a.id,
    date: a.date,
    presence: a.presence,
    excuseStatus: a.excuseStatus,
    excuse: a.excuse,
  }));
}

/**
 * Get excuses for a child
 */
export async function getChildExcuses(childId: string, limit = 10) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  // Verify parent has access to this child
  if (session.user.role === UserRole.PARENT) {
    const hasAccess = await canSubmitExcuse(session.user.id, childId);
    if (!hasAccess) {
      throw new Error("Access denied");
    }
  }

  const excuses = await prisma.excuse.findMany({
    where: { childId },
    orderBy: { submittedAt: "desc" },
    take: limit,
  });

  return excuses.map((e) => ({
    id: e.id,
    fromDate: e.fromDate,
    toDate: e.toDate,
    reason: e.reason,
    autoApproved: e.autoApproved,
    submittedAt: e.submittedAt,
  }));
}

/**
 * Submit a new excuse for a child
 */
export async function submitExcuse(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== UserRole.PARENT) {
    throw new Error("Unauthorized");
  }

  const childId = formData.get("childId") as string;
  const fromDateStr = formData.get("fromDate") as string;
  const toDateStr = formData.get("toDate") as string;
  const reason = formData.get("reason") as string | null;

  if (!childId || !fromDateStr || !toDateStr) {
    throw new Error("Missing required fields");
  }

  // Verify parent has access to this child
  const hasAccess = await canSubmitExcuse(session.user.id, childId);
  if (!hasAccess) {
    throw new Error("Access denied");
  }

  const fromDate = new Date(fromDateStr);
  const toDate = new Date(toDateStr);

  const excuse = await createExcuse(
    childId,
    fromDate,
    toDate,
    reason || null,
    session.user.id
  );

  revalidatePath("/rodic");
  revalidatePath("/rodic/omluvenka");

  return {
    success: true,
    excuse: {
      id: excuse.id,
      fromDate: excuse.fromDate,
      toDate: excuse.toDate,
      autoApproved: excuse.autoApproved,
    },
  };
}

/**
 * Get attendance statistics for a child
 */
export async function getChildStats(childId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  // Verify parent has access to this child
  if (session.user.role === UserRole.PARENT) {
    const hasAccess = await canSubmitExcuse(session.user.id, childId);
    if (!hasAccess) {
      throw new Error("Access denied");
    }
  }

  // Get stats for current month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const attendance = await prisma.attendance.findMany({
    where: {
      childId,
      date: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
  });

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
}
