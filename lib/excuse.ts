/**
 * Excuse Management for Habitat
 */

import { db } from "./db";
import {
  ExcuseDayPart,
  UserRole,
  type Excuse,
  type ExcuseDayPart as ExcuseDayPartValue,
  type UserRole as UserRoleType,
} from "./types";
import { ExcuseValidationError, validateExcuseDates } from "./excuse-rules";
import { getExcuseDayPartForRange } from "./excuse-input";
import { getLateDays, type CoveringExcuse } from "./excuse-coverage";
import { getSchoolDaysInRange } from "./school-days";
import { sendExcuseNotification } from "./slack";

export type ExcuseWithChild = Excuse & {
  child: {
    id: string;
    firstName: string;
    lastName: string;
  };
  submittedBy: {
    id: string;
    name: string | null;
  };
};

const startOfDay = (date: Date): number => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized.getTime();
};

/**
 * Every excuse that spans any part of the range, for deriving per-day state.
 * The Convex adapter bounds candidates by indexed start date and then applies
 * the remaining end-date condition server-side.
 */
export async function getExcusesOverlapping(range: {
  readonly childId?: string;
  readonly from: Date;
  readonly to: Date;
}): Promise<CoveringExcuse[]> {
  const excuses = (await db.excuses.listOverlapping(range)) as ReadonlyArray<Excuse>;
  const from = startOfDay(range.from);
  const to = startOfDay(range.to);
  return excuses.filter(
    (excuse) =>
      startOfDay(excuse.fromDate) <= to && startOfDay(excuse.toDate) >= from,
  );
}

/**
 * Create a new excuse
 */
export async function createExcuse(
  childId: string,
  fromDate: Date,
  toDate: Date,
  reason: string | null,
  submittedById: string,
  schoolDays?: ReadonlyArray<Date>,
  options?: {
    readonly approvedById?: string;
    readonly cancelLunch?: boolean;
    readonly dayPart?: ExcuseDayPartValue;
  },
): Promise<Excuse> {
  // Validate dates
  const validation = validateExcuseDates(fromDate, toDate);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Normalize dates
  const normalizedFrom = new Date(fromDate);
  normalizedFrom.setHours(0, 0, 0, 0);

  const normalizedTo = new Date(toDate);
  normalizedTo.setHours(0, 0, 0, 0);

  const childPromise = db.children.get({
    where: { id: childId },
    select: {
      firstName: true,
      lastName: true,
    },
  });
  const parentPromise = db.users.get({
    where: { id: submittedById },
    select: { name: true },
  });
  const lateApprovedAt = options?.approvedById ? new Date() : null;
  const dayPart = getExcuseDayPartForRange(
    options?.dayPart ?? ExcuseDayPart.FULL_DAY,
    normalizedFrom,
    normalizedTo,
  );
  const cancelLunch = options?.cancelLunch ?? true;

  // Director-created, no-lunch, and lunch-preserving excuses are approved in
  // the initial write.
  // The caller authorizes an explicit approving user before reaching this layer.
  const excuse = await db.excuses.create({
    data: {
      childId,
      fromDate: normalizedFrom,
      toDate: normalizedTo,
      reason,
      dayPart,
      cancelLunch,
      submittedById,
      lateApprovedAt,
      lateApprovedById: options?.approvedById ?? null,
    },
  });
  const automaticallyApproved =
    !options?.approvedById && excuse.lateApprovedAt !== null;

  // Attendance is untouched: whether these days count as excused is derived
  // from this record whenever it is read.
  const openSchoolDays =
    schoolDays ?? (await getSchoolDaysInRange(normalizedFrom, normalizedTo));
  const isOnTime = getLateDays(excuse, openSchoolDays).length === 0;

  // Create audit log
  await db.auditLogs.create({
    data: {
      userId: submittedById,
      action: "CREATE",
      entityType: "Excuse",
      entityId: excuse.id,
      newValue: {
        childId,
        fromDate: normalizedFrom.toISOString(),
        toDate: normalizedTo.toISOString(),
        reason,
        dayPart: excuse.dayPart,
        cancelLunch: excuse.cancelLunch,
        isOnTime,
        automaticallyApproved,
        lateApprovedAt: excuse.lateApprovedAt?.toISOString() ?? null,
        lateApprovedById: excuse.lateApprovedById,
      },
    },
  });

  // Await the durable outbox write. Convex also reconciles recent excuses so a
  // temporary failure between these writes is repaired automatically.
  try {
    await db.notifications.enqueueExcuse({ excuseId: excuse.id });
  } catch (error) {
    console.error("Failed to enqueue push notification; reconciliation will retry:", error);
  }

  // Send Slack notification (non-blocking)
  const [child, parent] = await Promise.all([childPromise, parentPromise]);

  if (child && parent) {
    // Fire and forget - don't block the response
    sendExcuseNotification({
      childName: `${child.firstName} ${child.lastName}`,
      parentName: parent.name || "Neznámý rodič",
      fromDate: normalizedFrom,
      toDate: normalizedTo,
      reason,
      dayPart: excuse.dayPart,
      cancelLunch: excuse.cancelLunch,
      isOnTime,
      automaticallyApproved,
    }).catch((error) => {
      console.error("Failed to send Slack notification:", error);
    });
  }

  return excuse;
}

/**
 * Get excuses for a child
 */
export async function getChildExcuses(
  childId: string,
  limit = 10
): Promise<Excuse[]> {
  return db.excuses.list({
    where: { childId },
    orderBy: { submittedAt: "desc" },
    take: limit,
  });
}

/**
 * Get all excuses with optional filters
 */
export async function getAllExcuses(options?: {
  childId?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<ExcuseWithChild[]> {
  const where: Record<string, unknown> = {};

  if (options?.childId) {
    where.childId = options.childId;
  }

  if (options?.startDate || options?.endDate) {
    where.fromDate = {};
    if (options?.startDate) {
      (where.fromDate as Record<string, Date>).gte = options.startDate;
    }
    if (options?.endDate) {
      (where.fromDate as Record<string, Date>).lte = options.endDate;
    }
  }

  return db.excuses.list({
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
        },
      },
    },
    orderBy: { submittedAt: "desc" },
  });
}

/**
 * Update an excuse after authorization has been checked by the caller.
 */
export async function updateExcuse(
  excuseId: string,
  updates: {
    fromDate?: Date;
    toDate?: Date;
    reason?: string | null;
    dayPart?: ExcuseDayPartValue;
  },
  userId: string
): Promise<Excuse> {
  const current = await db.excuses.get({
    where: { id: excuseId },
  });

  if (!current) {
    throw new Error("Excuse not found");
  }

  // Validate new dates if provided
  const newFromDate = updates.fromDate || current.fromDate;
  const newToDate = updates.toDate || current.toDate;
  const validation = validateExcuseDates(newFromDate, newToDate);
  if (!validation.valid) {
    throw new ExcuseValidationError(validation.error);
  }
  const newDayPart = getExcuseDayPartForRange(
    updates.dayPart ?? current.dayPart,
    newFromDate,
    newToDate,
  );
  const newCancelLunch = current.cancelLunch;

  // Growing the range would carry the original submission time onto days whose
  // deadline has since passed, which is how a stale excuse could be edited into
  // covering a day for free. Those days belong to a new excuse with its own
  // submission time; overlapping excuses are combined when they are read.
  if (
    startOfDay(newFromDate) < startOfDay(current.fromDate) ||
    startOfDay(newToDate) > startOfDay(current.toDate)
  ) {
    throw new ExcuseValidationError(
      "Rozsah omluvenky nelze rozšířit. Na další dny podejte novou omluvenku.",
    );
  }

  // Create audit log
  await db.auditLogs.create({
    data: {
      userId,
      action: "UPDATE",
      entityType: "Excuse",
      entityId: excuseId,
      previousValue: {
        fromDate: current.fromDate.toISOString(),
        toDate: current.toDate.toISOString(),
        reason: current.reason,
        dayPart: current.dayPart,
        cancelLunch: current.cancelLunch,
        lateApprovedAt: current.lateApprovedAt?.toISOString() ?? null,
      },
      newValue: {
        fromDate: newFromDate.toISOString(),
        toDate: newToDate.toISOString(),
        reason: updates.reason !== undefined ? updates.reason : current.reason,
        dayPart: newDayPart,
        cancelLunch: newCancelLunch,
        lateApprovedAt: current.lateApprovedAt?.toISOString() ?? null,
      },
    },
  });

  // Update the excuse
  const normalizedFrom = new Date(newFromDate);
  normalizedFrom.setHours(0, 0, 0, 0);

  const normalizedTo = new Date(newToDate);
  normalizedTo.setHours(0, 0, 0, 0);

  const updated = await db.excuses.update({
    where: { id: excuseId },
    data: {
      fromDate: normalizedFrom,
      toDate: normalizedTo,
      reason: updates.reason !== undefined ? updates.reason : current.reason,
      dayPart: newDayPart,
      cancelLunch: newCancelLunch,
    },
  });

  const changed =
    current.fromDate.getTime() !== updated.fromDate.getTime() ||
    current.toDate.getTime() !== updated.toDate.getTime() ||
    current.reason !== updated.reason ||
    current.dayPart !== updated.dayPart;

  if (changed) {
    try {
      const [child, parent, schoolDays] = await Promise.all([
        db.children.get({
          where: { id: updated.childId },
          select: { firstName: true, lastName: true },
        }),
        db.users.get({
          where: { id: updated.submittedById },
          select: { name: true },
        }),
        getSchoolDaysInRange(updated.fromDate, updated.toDate),
      ]);
      if (child && parent) {
        // Await the webhook so the server does not stop before sending the edit.
        await sendExcuseNotification({
          change: "UPDATED",
          childName: `${child.firstName} ${child.lastName}`,
          parentName: parent.name || "Neznámý rodič",
          fromDate: updated.fromDate,
          toDate: updated.toDate,
          reason: updated.reason,
          dayPart: updated.dayPart,
          cancelLunch: updated.cancelLunch,
          isOnTime: getLateDays(updated, schoolDays).length === 0,
          automaticallyApproved:
            updated.lateApprovedAt !== null && updated.lateApprovedById === null,
        });
      }
    } catch (error) {
      console.error("Failed to send updated excuse to Slack:", error);
    }
  }

  return updated;
}

/**
 * Delete an excuse after authorization has been checked by the caller.
 */
export async function deleteExcuse(excuseId: string, userId: string): Promise<void> {
  const excuse = await db.excuses.get({
    where: { id: excuseId },
  });

  if (!excuse) {
    throw new Error("Excuse not found");
  }

  // Create audit log
  await db.auditLogs.create({
    data: {
      userId,
      action: "DELETE",
      entityType: "Excuse",
      entityId: excuseId,
      previousValue: {
        childId: excuse.childId,
        fromDate: excuse.fromDate.toISOString(),
        toDate: excuse.toDate.toISOString(),
        reason: excuse.reason,
        dayPart: excuse.dayPart,
        cancelLunch: excuse.cancelLunch,
        lateApprovedAt: excuse.lateApprovedAt?.toISOString() ?? null,
      },
    },
  });

  // Attendance carries no excuse state, so the remaining excuses for those days
  // take effect on the next read without any cleanup here.

  // Delete the excuse
  await db.excuses.remove({
    where: { id: excuseId },
  });
}

/**
 * Check if a user can submit an excuse for a child
 */
export async function canSubmitExcuse(
  userId: string,
  childId: string
): Promise<boolean> {
  const parentChild = await db.parentLinks.get({
    where: {
      parentId_childId: {
        parentId: userId,
        childId,
      },
    },
  });

  return !!parentChild;
}

export async function canManageExcuse(
  user: { readonly id: string; readonly role: UserRoleType },
  childId: string,
): Promise<boolean> {
  if (user.role === UserRole.DIRECTOR) {
    return true;
  }

  if (user.role !== UserRole.PARENT) {
    return false;
  }

  return canSubmitExcuse(user.id, childId);
}

export async function canManageExcuses(
  user: { readonly id: string; readonly role: UserRoleType },
  childIds: ReadonlyArray<string>,
): Promise<boolean> {
  const access = await Promise.all(
    childIds.map((childId) => canManageExcuse(user, childId)),
  );
  return access.every(Boolean);
}

/** The parent form commits all siblings, audits and notification jobs together. */
export async function createParentExcuses(
  input: {
    parentId: string;
    requestId: string;
    childIds: string[];
    fromDate: Date;
    toDate: Date;
    reason: string | null;
    cancelLunch: boolean;
    dayPart?: "FULL_DAY" | "MORNING" | "AFTERNOON";
  },
  schoolDays: ReadonlyArray<Date>,
): Promise<Excuse[]> {
  const validation = validateExcuseDates(input.fromDate, input.toDate);
  if (!validation.valid) throw new Error(validation.error);
  const result = await db.excuses.createParentBatch(input);
  if (!result.replayed) {
    // A failed secondary notification must never report the committed form as failed.
    try {
      const parent = await db.users.get({ where: { id: input.parentId } });
      for (const excuse of result.excuses as Excuse[]) {
        const child = await db.children.get({ where: { id: excuse.childId } });
        if (child && parent) {
          sendExcuseNotification({
            childName: `${child.firstName} ${child.lastName}`,
            parentName: parent.name || "Neznámý rodič",
            fromDate: excuse.fromDate,
            toDate: excuse.toDate,
            reason: excuse.reason,
            cancelLunch: excuse.cancelLunch,
            dayPart: excuse.dayPart,
            isOnTime: getLateDays(excuse, schoolDays).length === 0,
            automaticallyApproved: excuse.lateApprovedAt !== null,
          }).catch((error) =>
            console.error("Failed to send Slack notification", error),
          );
        }
      }
    } catch (error) {
      console.error("Failed to prepare Slack notification", error);
    }
  }
  return result.excuses;
}
