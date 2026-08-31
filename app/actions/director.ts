"use server";

import { getDbUser, type SessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPresenceLabel } from "@/lib/presence-label";
import {
  UserRole,
  Presence,
  AuditAction,
  type Attendance,
  type AuditLog,
  type Child,
  type ChildGender,
  type Excuse,
  type ParentChild,
  type User,
} from "@/lib/types";
import { getSchoolDaysInRange } from "@/lib/school-days";
import {
  getLocalDateKey,
  getLunchStatus,
  isPayableLunch,
  sortChildrenWithSiblings,
  type LunchStatus,
} from "@/lib/lunches";
import { revalidatePath } from "next/cache";
import {
  deleteExcuse as deleteExcuseRecord,
  getExcusesOverlapping,
  updateExcuse as updateExcuseRecord,
} from "@/lib/excuse";
import {
  getDayCoverage,
  getExcuseRangeState,
  groupExcusesByChild,
  isExcuseSettled,
  NO_COVERAGE,
  type ExcuseRangeState,
} from "@/lib/excuse-coverage";
import { parseExcuseDate } from "@/lib/excuse-rules";

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

type LunchChildWithParentsRow = Child & {
  readonly parents: ReadonlyArray<{
    readonly parent: {
      readonly id: string;
    };
  }>;
};

export type LunchOverview = {
  readonly month: string;
  readonly monthLabel: string;
  readonly days: ReadonlyArray<{
    readonly key: string;
    readonly day: number;
    readonly weekday: string;
  }>;
  readonly children: ReadonlyArray<{
    readonly id: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly statuses: ReadonlyArray<LunchStatus | null>;
    readonly payableLunches: number;
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

async function getSchoolDaysCoveringExcuses(
  excuses: ReadonlyArray<Excuse>,
): Promise<ReadonlyArray<Date>> {
  if (excuses.length === 0) return [];
  const { from, to } = excuses.reduce(
    (range, excuse) => ({
      from: Math.min(range.from, excuse.fromDate.getTime()),
      to: Math.max(range.to, excuse.toDate.getTime()),
    }),
    { from: Number.POSITIVE_INFINITY, to: Number.NEGATIVE_INFINITY },
  );
  return getSchoolDaysInRange(new Date(from), new Date(to));
}

/**
 * Get the monthly lunch billing overview for all active children.
 */
export async function getLunchOverview(month: string): Promise<LunchOverview> {
  await requireDirector();

  const match = /^(\d{4})-(\d{2})$/.exec(month);
  const year = match ? Number(match[1]) : Number.NaN;
  const monthIndex = match ? Number(match[2]) - 1 : Number.NaN;

  if (
    !Number.isInteger(year) ||
    year < 2000 ||
    year > 2100 ||
    !Number.isInteger(monthIndex) ||
    monthIndex < 0 ||
    monthIndex > 11
  ) {
    throw new Error("Neplatný měsíc");
  }

  const startOfMonth = new Date(year, monthIndex, 1);
  const endOfMonth = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

  const [schoolDays, children, attendance, excuses] = await Promise.all([
    getSchoolDaysInRange(startOfMonth, endOfMonth),
    db.children.list({
      where: { active: true },
      include: {
        parents: {
          include: {
            parent: {
              select: { id: true },
            },
          },
        },
      },
    }) as Promise<ReadonlyArray<LunchChildWithParentsRow>>,
    db.attendance.list({
      where: {
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    }) as Promise<ReadonlyArray<Attendance>>,
    getExcusesOverlapping({ from: startOfMonth, to: endOfMonth }),
  ]);

  const excusesByChild = groupExcusesByChild(excuses);
  const sortedChildren = sortChildrenWithSiblings(
    children.map((child) => ({
      ...child,
      parentIds: child.parents.map(({ parent }) => parent.id),
    })),
  );
  const attendanceByChildAndDate = new Map(
    attendance.map((record) => [
      `${record.childId}:${getLocalDateKey(record.date)}`,
      record,
    ]),
  );
  const days = schoolDays.map((date) => ({
    date,
    key: getLocalDateKey(date),
    day: date.getDate(),
    weekday: ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"][date.getDay()],
  }));

  return {
    month,
    monthLabel: new Intl.DateTimeFormat("cs-CZ", {
      month: "long",
      year: "numeric",
    }).format(startOfMonth),
    days: days.map(({ key, day, weekday }) => ({ key, day, weekday })),
    children: sortedChildren.map((child) => {
      const childExcuses = excusesByChild.get(child.id) ?? [];
      const statuses = days.map((day) =>
        getLunchStatus(
          attendanceByChildAndDate.get(`${child.id}:${day.key}`),
          getDayCoverage(childExcuses, day.date),
        ),
      );

      return {
        id: child.id,
        firstName: child.firstName,
        lastName: child.lastName,
        statuses,
        payableLunches: statuses.filter(isPayableLunch).length,
      };
    }),
  };
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

  const monthExcuses = groupExcusesByChild(
    await getExcusesOverlapping({ from: startOfMonth, to: endOfMonth }),
  );
  const monthAbsences = monthAttendance
    .filter((a) => a.presence === Presence.ABSENT)
    .map((a) =>
      getDayCoverage(monthExcuses.get(a.childId) ?? [], a.date).excused,
    );
  const excusedCount = monthAbsences.filter(Boolean).length;
  const unexcusedCount = monthAbsences.length - excusedCount;

  // Recent excuses still waiting for the director to forgive a late submission
  const recentExcuseCandidates = (await db.excuses.list({
    where: {
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
  })) as ReadonlyArray<Excuse & { child: { firstName: string; lastName: string } }>;
  const recentSchoolDays = await getSchoolDaysCoveringExcuses(
    recentExcuseCandidates,
  );
  const recentExcuses = recentExcuseCandidates
    .filter((excuse) => !isExcuseSettled(excuse, recentSchoolDays))
    .slice(0, 5);

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
      absentCount: monthAbsences.length,
      excusedCount,
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
  settledOnly?: boolean;
  pendingOnly?: boolean;
}) {
  await requireDirector();

  const excuses = (await db.excuses.list({
    where: {},
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
  })) as ReadonlyArray<ExcuseWithChildAndSubmitter>;
  const schoolDays = await getSchoolDaysCoveringExcuses(excuses);

  // Whether an excuse still needs a decision is derived, so it cannot be
  // pushed down into the query.
  const filtered = excuses.filter((excuse) => {
    if (options?.settledOnly) return isExcuseSettled(excuse, schoolDays);
    if (options?.pendingOnly) return !isExcuseSettled(excuse, schoolDays);
    return true;
  });

  return filtered.slice(0, 100).map((excuse) => ({
    ...excuse,
    rangeState: getExcuseRangeState(excuse, schoolDays) satisfies ExcuseRangeState,
  }));
}

/**
 * Forgive a late submission, or take that decision back. On-time excuses have
 * nothing to decide; delete them instead if they should not stand.
 */
export async function updateExcuse(excuseId: string, approveLate: boolean) {
  const user = await requireDirector();

  const excuse = await db.excuses.get({
    where: { id: excuseId },
  });

  if (!excuse) {
    throw new Error("Excuse not found");
  }

  const lateApprovedAt = approveLate ? new Date() : null;
  const lateApprovedById = approveLate ? user.id : null;

  // Create audit log
  await db.auditLogs.create({
    data: {
      userId: user.id,
      action: AuditAction.UPDATE,
      entityType: "Excuse",
      entityId: excuseId,
      previousValue: {
        lateApprovedAt: excuse.lateApprovedAt?.toISOString() ?? null,
      },
      newValue: { lateApprovedAt: lateApprovedAt?.toISOString() ?? null },
    },
  });

  // The decision only lives on the excuse. Every day it covers picks it up on
  // the next read, including days another overlapping excuse also covers.
  const updated = await db.excuses.update({
    where: { id: excuseId },
    data: { lateApprovedAt, lateApprovedById },
  });

  revalidatePath("/reditel/omluvenky");
  revalidatePath("/rodic");
  revalidatePath("/kalendar");
  revalidatePath("/reditel/obedy");

  return updated;
}

type ExcuseEditInput = {
  readonly fromDate: string;
  readonly toDate: string;
  readonly reason: string;
};

export async function editExcuse(excuseId: string, input: ExcuseEditInput) {
  const user = await requireDirector();

  const updated = await updateExcuseRecord(
    excuseId,
    {
      fromDate: parseExcuseDate(input.fromDate),
      toDate: parseExcuseDate(input.toDate),
      reason: input.reason.trim() || null,
    },
    user.id,
  );

  revalidatePath("/reditel/omluvenky");
  revalidatePath("/rodic");
  revalidatePath("/reditel/obedy");
  return updated;
}

export async function deleteExcuse(excuseId: string): Promise<void> {
  const user = await requireDirector();
  await deleteExcuseRecord(excuseId, user.id);
  revalidatePath("/reditel/omluvenky");
  revalidatePath("/rodic");
  revalidatePath("/reditel/obedy");
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
  revalidatePath("/reditel/obedy");

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
  revalidatePath("/reditel/obedy");
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

  const [attendance, excuses] = await Promise.all([
    db.attendance.list({
      where,
      include: {
        child: {
          select: {
            firstName: true,
            lastName: true,
            gender: true,
          },
        },
      },
      orderBy: [{ date: "asc" }, { child: { lastName: "asc" } }],
    }) as Promise<ReadonlyArray<AttendanceWithChild>>,
    getExcusesOverlapping({ childId, from: start, to: end }),
  ]);

  const excusesByChild = groupExcusesByChild(excuses);

  // Build CSV
  const headers = [
    "Datum",
    "Jméno",
    "Příjmení",
    "Přítomnost",
    "Stav omluvy",
    "Důvod",
  ];
  const rows = attendance.map((a) => {
    const coverage =
      a.presence === Presence.ABSENT
        ? getDayCoverage(excusesByChild.get(a.childId) ?? [], a.date)
        : NO_COVERAGE;

    return [
      a.date.toLocaleDateString("cs-CZ"),
      a.child.firstName,
      a.child.lastName,
      getPresenceLabel(a.presence === Presence.PRESENT, a.child.gender),
      a.presence === Presence.PRESENT
        ? ""
        : coverage.excused
        ? "Omluveno"
        : "Neomluveno",
      coverage.excuse?.reason || "",
    ];
  });

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
  revalidatePath("/reditel/obedy");

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
  revalidatePath("/reditel/obedy");

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
  revalidatePath("/reditel/obedy");

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
  revalidatePath("/reditel/obedy");

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
  revalidatePath("/reditel/obedy");
}
