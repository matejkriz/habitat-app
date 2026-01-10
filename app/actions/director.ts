"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserRole, Presence, ExcuseStatus, AuditAction, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

// Type for audit log with included user relation
type AuditLogWithUser = Prisma.AuditLogGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        name: true;
        email: true;
      };
    };
  };
}>;

/**
 * Ensure user is director
 */
async function requireDirector() {
  const session = await auth();
  if (!session?.user || session.user.role !== UserRole.DIRECTOR) {
    throw new Error("Unauthorized");
  }
  return session.user;
}

/**
 * Get dashboard overview stats
 */
export async function getDashboardStats() {
  await requireDirector();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  // Get today's attendance
  const todayAttendance = await prisma.attendance.findMany({
    where: { date: today },
  });

  // Get this month's stats
  const monthAttendance = await prisma.attendance.findMany({
    where: {
      date: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
  });

  // Get unexcused absences this month
  const unexcusedCount = monthAttendance.filter(
    (a) => a.presence === Presence.ABSENT && a.excuseStatus === ExcuseStatus.UNEXCUSED
  ).length;

  // Get recent excuses pending review
  const recentExcuses = await prisma.excuse.findMany({
    where: {
      autoApproved: false,
      submittedAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      },
    },
    include: {
      child: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { submittedAt: "desc" },
    take: 5,
  });

  // Get children count
  const childrenCount = await prisma.child.count({ where: { active: true } });

  return {
    today: {
      present: todayAttendance.filter((a) => a.presence === Presence.PRESENT).length,
      absent: todayAttendance.filter((a) => a.presence === Presence.ABSENT).length,
      total: childrenCount,
      recorded: todayAttendance.length > 0,
    },
    month: {
      totalRecords: monthAttendance.length,
      presentCount: monthAttendance.filter((a) => a.presence === Presence.PRESENT).length,
      absentCount: monthAttendance.filter((a) => a.presence === Presence.ABSENT).length,
      excusedCount: monthAttendance.filter(
        (a) => a.excuseStatus === ExcuseStatus.EXCUSED
      ).length,
      unexcusedCount,
    },
    recentExcuses: recentExcuses.map((e) => ({
      id: e.id,
      childName: `${e.child.firstName} ${e.child.lastName}`,
      fromDate: e.fromDate,
      toDate: e.toDate,
      reason: e.reason,
      submittedAt: e.submittedAt,
    })),
  };
}

/**
 * Get all excuses with filters
 */
export async function getExcuses(options?: {
  autoApprovedOnly?: boolean;
  pendingOnly?: boolean;
}) {
  await requireDirector();

  const where: Record<string, unknown> = {};

  if (options?.autoApprovedOnly) {
    where.autoApproved = true;
  }

  if (options?.pendingOnly) {
    where.autoApproved = false;
  }

  const excuses = await prisma.excuse.findMany({
    where,
    include: {
      child: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      submittedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { submittedAt: "desc" },
    take: 100,
  });

  return excuses;
}

/**
 * Update an excuse (approve/reject)
 */
export async function updateExcuse(excuseId: string, autoApproved: boolean) {
  const user = await requireDirector();

  const excuse = await prisma.excuse.findUnique({
    where: { id: excuseId },
  });

  if (!excuse) {
    throw new Error("Excuse not found");
  }

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: AuditAction.UPDATE,
      entityType: "Excuse",
      entityId: excuseId,
      previousValue: { autoApproved: excuse.autoApproved },
      newValue: { autoApproved },
    },
  });

  // Update excuse
  const updated = await prisma.excuse.update({
    where: { id: excuseId },
    data: { autoApproved },
  });

  // Update related attendance records
  await prisma.attendance.updateMany({
    where: {
      excuseId,
      presence: Presence.ABSENT,
    },
    data: {
      excuseStatus: autoApproved ? ExcuseStatus.EXCUSED : ExcuseStatus.UNEXCUSED,
    },
  });

  revalidatePath("/reditel/omluvenky");
  revalidatePath("/rodic");

  return updated;
}

/**
 * Get closed days
 */
export async function getClosedDays(year?: number) {
  await requireDirector();

  const targetYear = year || new Date().getFullYear();
  const startOfYear = new Date(targetYear, 0, 1);
  const endOfYear = new Date(targetYear, 11, 31);

  const closedDays = await prisma.closedDay.findMany({
    where: {
      date: {
        gte: startOfYear,
        lte: endOfYear,
      },
    },
    orderBy: { date: "asc" },
  });

  return closedDays;
}

/**
 * Add a closed day
 */
export async function addClosedDay(dateStr: string, description?: string) {
  const user = await requireDirector();

  const date = new Date(dateStr);
  date.setHours(0, 0, 0, 0);

  const closedDay = await prisma.closedDay.create({
    data: {
      date,
      description: description || null,
    },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: AuditAction.CREATE,
      entityType: "ClosedDay",
      entityId: closedDay.id,
      newValue: { date: dateStr, description },
    },
  });

  revalidatePath("/reditel/volne-dny");

  return closedDay;
}

/**
 * Remove a closed day
 */
export async function removeClosedDay(id: string) {
  const user = await requireDirector();

  const closedDay = await prisma.closedDay.findUnique({
    where: { id },
  });

  if (!closedDay) {
    throw new Error("Closed day not found");
  }

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: AuditAction.DELETE,
      entityType: "ClosedDay",
      entityId: id,
      previousValue: {
        date: closedDay.date.toISOString(),
        description: closedDay.description,
      },
    },
  });

  await prisma.closedDay.delete({
    where: { id },
  });

  revalidatePath("/reditel/volne-dny");
}

/**
 * Get audit logs
 */
export async function getAuditLogs(limit = 50): Promise<AuditLogWithUser[]> {
  await requireDirector();

  const logs = await prisma.auditLog.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return logs;
}

/**
 * Export attendance data to CSV format
 */
export async function exportAttendanceCSV(
  startDate: string,
  endDate: string,
  childId?: string
) {
  await requireDirector();

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const where: Record<string, unknown> = {
    date: {
      gte: start,
      lte: end,
    },
  };

  if (childId) {
    where.childId = childId;
  }

  const attendance = await prisma.attendance.findMany({
    where,
    include: {
      child: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      excuse: {
        select: {
          reason: true,
        },
      },
    },
    orderBy: [{ date: "asc" }, { child: { lastName: "asc" } }],
  });

  // Build CSV
  const headers = ["Datum", "Jméno", "Příjmení", "Přítomnost", "Stav omluvy", "Důvod"];
  const rows = attendance.map((a) => [
    a.date.toLocaleDateString("cs-CZ"),
    a.child.firstName,
    a.child.lastName,
    a.presence === Presence.PRESENT ? "Přítomen" : "Nepřítomen",
    a.excuseStatus === ExcuseStatus.NONE
      ? ""
      : a.excuseStatus === ExcuseStatus.EXCUSED
      ? "Omluveno"
      : "Neomluveno",
    a.excuse?.reason || "",
  ]);

  const csvContent = [
    headers.join(";"),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(";")),
  ].join("\n");

  return csvContent;
}
