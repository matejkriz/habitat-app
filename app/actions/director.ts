"use server";

import { getDbUser, type SessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPresenceLabel } from "@/lib/presence-label";
import {
  UserRole,
  Presence,
  ExcuseStatus,
  AuditAction,
  type Attendance,
  type AuditLog,
  type Child,
  type ChildGender,
  type Excuse,
  type ParentChild,
  type User,
} from "@/lib/types";
import { revalidatePath } from "next/cache";

// Type for audit log with included user relation
export type AuditLogWithUser = AuditLog & {
  readonly user: {
    readonly id: string;
    readonly name: string | null;
    readonly email: string | null;
  } | null;
};

type AttendanceWithChild = Attendance & {
  readonly child: {
    readonly id: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly gender: ChildGender | null;
  };
  readonly excuse?: {
    readonly reason?: string | null;
  } | null;
};

type ExcuseWithChildAndSubmitter = Excuse & {
  readonly child: {
    readonly id: string;
    readonly firstName: string;
    readonly lastName: string;
  };
  readonly submittedBy: {
    readonly id: string;
    readonly name: string | null;
    readonly email: string | null;
  };
};

type ChildWithParentsRow = Child & {
  readonly parents: ReadonlyArray<{
    readonly parent: {
      readonly id: string;
      readonly name: string | null;
      readonly email: string | null;
    };
  }>;
};

type ParentChildWithParentAndChild = ParentChild & {
  readonly parent: {
    readonly name: string | null;
    readonly email: string | null;
  };
  readonly child: {
    readonly firstName: string;
    readonly lastName: string;
  };
};

// Return type for dashboard stats
export type DashboardStats = {
  today: {
    present: number;
    absent: number;
    total: number;
    recorded: boolean;
  };
  month: {
    totalRecords: number;
    presentCount: number;
    absentCount: number;
    excusedCount: number;
    unexcusedCount: number;
  };
  recentExcuses: Array<{
    id: string;
    childName: string;
    fromDate: Date;
    toDate: Date;
    reason: string | null;
    submittedAt: Date;
  }>;
};

/**
 * Ensure user is director
 */
async function requireDirector(): Promise<SessionUser> {
  const user = await getDbUser();
  if (!user || user.role !== UserRole.DIRECTOR) {
    throw new Error("Unauthorized");
  }
  return user;
}

/**
 * Get dashboard overview stats
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  await requireDirector();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  // Get today's attendance
  const todayAttendance = (await db.attendance.list({
    where: { date: today },
  })) as ReadonlyArray<Attendance>;

  // Get this month's stats
  const monthAttendance = (await db.attendance.list({
    where: {
      date: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
  })) as ReadonlyArray<Attendance>;

  // Get unexcused absences this month
  const unexcusedCount = monthAttendance.filter(
    (a) =>
      a.presence === Presence.ABSENT &&
      a.excuseStatus === ExcuseStatus.UNEXCUSED
  ).length;

  // Get recent excuses pending review
  const recentExcuses = (await db.excuses.list({
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
  })) as ReadonlyArray<Excuse & { child: { firstName: string; lastName: string } }>;

  // Get children count
  const childrenCount = await db.children.count({ where: { active: true } });

  return {
    today: {
      present: todayAttendance.filter((a) => a.presence === Presence.PRESENT)
        .length,
      absent: todayAttendance.filter((a) => a.presence === Presence.ABSENT)
        .length,
      total: childrenCount,
      recorded: todayAttendance.length > 0,
    },
    month: {
      totalRecords: monthAttendance.length,
      presentCount: monthAttendance.filter(
        (a) => a.presence === Presence.PRESENT
      ).length,
      absentCount: monthAttendance.filter((a) => a.presence === Presence.ABSENT)
        .length,
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

  const excuses = (await db.excuses.list({
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
  })) as ReadonlyArray<ExcuseWithChildAndSubmitter>;

  return excuses;
}

/**
 * Update an excuse (approve/reject)
 */
export async function updateExcuse(excuseId: string, autoApproved: boolean) {
  const user = await requireDirector();

  const excuse = await db.excuses.get({
    where: { id: excuseId },
  });

  if (!excuse) {
    throw new Error("Excuse not found");
  }

  // Create audit log
  await db.auditLogs.create({
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
  const updated = await db.excuses.update({
    where: { id: excuseId },
    data: { autoApproved },
  });

  // Update related attendance records
  await db.attendance.bulkUpdate({
    where: {
      excuseId,
      presence: Presence.ABSENT,
    },
    data: {
      excuseStatus: autoApproved
        ? ExcuseStatus.EXCUSED
        : ExcuseStatus.UNEXCUSED,
    },
  });

  revalidatePath("/reditel/omluvenky");
  revalidatePath("/rodic");
  revalidatePath("/kalendar");

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

  const closedDays = await db.closedDays.list({
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

  const closedDay = await db.closedDays.create({
    data: {
      date,
      description: description || null,
    },
  });

  // Create audit log
  await db.auditLogs.create({
    data: {
      userId: user.id,
      action: AuditAction.CREATE,
      entityType: "ClosedDay",
      entityId: closedDay.id,
      newValue: { date: dateStr, description },
    },
  });

  revalidatePath("/reditel/volne-dny");
  revalidatePath("/kalendar");

  return closedDay;
}

/**
 * Remove a closed day
 */
export async function removeClosedDay(id: string) {
  const user = await requireDirector();

  const closedDay = await db.closedDays.get({
    where: { id },
  });

  if (!closedDay) {
    throw new Error("Closed day not found");
  }

  // Create audit log
  await db.auditLogs.create({
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

  await db.closedDays.remove({
    where: { id },
  });

  revalidatePath("/reditel/volne-dny");
  revalidatePath("/kalendar");
}

/**
 * Get audit logs
 */
export async function getAuditLogs(
  limit = 50,
): Promise<ReadonlyArray<AuditLogWithUser>> {
  await requireDirector();

  const logs = (await db.auditLogs.list({
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
  })) as ReadonlyArray<AuditLogWithUser>;

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

  const attendance = (await db.attendance.list({
    where,
    include: {
      child: {
        select: {
          firstName: true,
          lastName: true,
          gender: true,
        },
      },
      excuse: {
        select: {
          reason: true,
        },
      },
    },
    orderBy: [{ date: "asc" }, { child: { lastName: "asc" } }],
  })) as ReadonlyArray<AttendanceWithChild>;

  // Build CSV
  const headers = [
    "Datum",
    "Jméno",
    "Příjmení",
    "Přítomnost",
    "Stav omluvy",
    "Důvod",
  ];
  const rows = attendance.map((a) => [
    a.date.toLocaleDateString("cs-CZ"),
    a.child.firstName,
    a.child.lastName,
    getPresenceLabel(a.presence === Presence.PRESENT, a.child.gender),
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

// ============================================
// Children Management
// ============================================

/**
 * Type for child with parents
 */
export type ChildWithParents = {
  id: string;
  firstName: string;
  lastName: string;
  gender: ChildGender | null;
  active: boolean;
  createdAt: Date;
  parents: Array<{
    id: string;
    name: string | null;
    email: string | null;
  }>;
};

/**
 * Get all children with their assigned parents
 */
export async function getAllChildrenWithParents(): Promise<ChildWithParents[]> {
  await requireDirector();

  const children = (await db.children.list({
    include: {
      parents: {
        include: {
          parent: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: [{ active: "desc" }, { lastName: "asc" }, { firstName: "asc" }],
  })) as ReadonlyArray<ChildWithParentsRow>;

  return children.map((child) => ({
    id: child.id,
    firstName: child.firstName,
    lastName: child.lastName,
    gender: child.gender,
    active: child.active,
    createdAt: child.createdAt,
    parents: child.parents.map((pc) => ({
      id: pc.parent.id,
      name: pc.parent.name,
      email: pc.parent.email,
    })),
  }));
}

/**
 * Get all parents (users with PARENT role)
 */
export async function getAllParents() {
  await requireDirector();

  const parents = (await db.users.list({
    where: { role: UserRole.PARENT },
    select: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  })) as ReadonlyArray<Pick<User, "id" | "name" | "email">>;

  return parents;
}

/**
 * Create a new child
 */
export async function createChild(
  firstName: string,
  lastName: string,
  gender: ChildGender,
) {
  const user = await requireDirector();

  if (!firstName.trim() || !lastName.trim()) {
    throw new Error("Jméno a příjmení jsou povinné");
  }
  if (gender !== "MALE" && gender !== "FEMALE") {
    throw new Error("Pohlaví je povinné");
  }

  const child = await db.children.create({
    data: {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      gender,
      active: true,
    },
  });

  // Create audit log
  await db.auditLogs.create({
    data: {
      userId: user.id,
      action: AuditAction.CREATE,
      entityType: "Child",
      entityId: child.id,
      newValue: { firstName: child.firstName, lastName: child.lastName, gender: child.gender },
    },
  });

  revalidatePath("/reditel/deti");
  revalidatePath("/ucitel/dochazka");
  revalidatePath("/kalendar");

  return child;
}

/**
 * Update a child's information
 */
export async function updateChild(
  childId: string,
  data: { firstName?: string; lastName?: string; gender?: ChildGender }
) {
  const user = await requireDirector();

  const child = await db.children.get({
    where: { id: childId },
  });

  if (!child) {
    throw new Error("Dítě nebylo nalezeno");
  }

  const updateData: { firstName?: string; lastName?: string; gender?: ChildGender } = {};
  if (data.firstName !== undefined) {
    if (!data.firstName.trim()) {
      throw new Error("Jméno je povinné");
    }
    updateData.firstName = data.firstName.trim();
  }
  if (data.lastName !== undefined) {
    if (!data.lastName.trim()) {
      throw new Error("Příjmení je povinné");
    }
    updateData.lastName = data.lastName.trim();
  }
  if (data.gender !== undefined) {
    if (data.gender !== "MALE" && data.gender !== "FEMALE") {
      throw new Error("Neplatné pohlaví");
    }
    updateData.gender = data.gender;
  }

  // Create audit log
  await db.auditLogs.create({
    data: {
      userId: user.id,
      action: AuditAction.UPDATE,
      entityType: "Child",
      entityId: childId,
      previousValue: { firstName: child.firstName, lastName: child.lastName, gender: child.gender },
      newValue: updateData,
    },
  });

  const updated = await db.children.update({
    where: { id: childId },
    data: updateData,
  });

  revalidatePath("/reditel/deti");
  revalidatePath("/ucitel/dochazka");
  revalidatePath("/rodic");
  revalidatePath("/kalendar");

  return updated;
}

/**
 * Toggle child active status
 */
export async function toggleChildActive(childId: string, active: boolean) {
  const user = await requireDirector();

  const child = await db.children.get({
    where: { id: childId },
  });

  if (!child) {
    throw new Error("Dítě nebylo nalezeno");
  }

  // Create audit log
  await db.auditLogs.create({
    data: {
      userId: user.id,
      action: AuditAction.UPDATE,
      entityType: "Child",
      entityId: childId,
      previousValue: { active: child.active },
      newValue: { active },
    },
  });

  const updated = await db.children.update({
    where: { id: childId },
    data: { active },
  });

  revalidatePath("/reditel/deti");
  revalidatePath("/ucitel/dochazka");
  revalidatePath("/kalendar");

  return updated;
}

/**
 * Assign a parent to a child
 */
export async function assignParentToChild(parentId: string, childId: string) {
  const user = await requireDirector();

  // Verify parent exists and is a PARENT role
  const parent = await db.users.get({
    where: { id: parentId },
  });

  if (!parent || parent.role !== UserRole.PARENT) {
    throw new Error("Rodič nebyl nalezen nebo není rodičovský účet");
  }

  // Verify child exists
  const child = await db.children.get({
    where: { id: childId },
  });

  if (!child) {
    throw new Error("Dítě nebylo nalezeno");
  }

  // Check if relationship already exists
  const existingRelation = await db.parentLinks.get({
    where: {
      parentId_childId: {
        parentId,
        childId,
      },
    },
  });

  if (existingRelation) {
    throw new Error("Rodič je již přiřazen k tomuto dítěti");
  }

  const parentChild = await db.parentLinks.create({
    data: {
      parentId,
      childId,
    },
  });

  // Create audit log
  await db.auditLogs.create({
    data: {
      userId: user.id,
      action: AuditAction.CREATE,
      entityType: "ParentChild",
      entityId: parentChild.id,
      newValue: {
        parentId,
        parentName: parent.name,
        parentEmail: parent.email,
        childId,
        childName: `${child.firstName} ${child.lastName}`,
      },
    },
  });

  revalidatePath("/reditel/deti");
  revalidatePath("/rodic");

  return parentChild;
}

/**
 * Remove a parent from a child
 */
export async function removeParentFromChild(parentId: string, childId: string) {
  const user = await requireDirector();

  const parentChild = (await db.parentLinks.get({
    where: {
      parentId_childId: {
        parentId,
        childId,
      },
    },
    include: {
      parent: {
        select: { name: true, email: true },
      },
      child: {
        select: { firstName: true, lastName: true },
      },
    },
  })) as ParentChildWithParentAndChild | null;

  if (!parentChild) {
    throw new Error("Vztah rodič-dítě nebyl nalezen");
  }

  // Create audit log
  await db.auditLogs.create({
    data: {
      userId: user.id,
      action: AuditAction.DELETE,
      entityType: "ParentChild",
      entityId: parentChild.id,
      previousValue: {
        parentId,
        parentName: parentChild.parent.name,
        parentEmail: parentChild.parent.email,
        childId,
        childName: `${parentChild.child.firstName} ${parentChild.child.lastName}`,
      },
    },
  });

  await db.parentLinks.remove({
    where: {
      parentId_childId: {
        parentId,
        childId,
      },
    },
  });

  revalidatePath("/reditel/deti");
  revalidatePath("/rodic");
}
