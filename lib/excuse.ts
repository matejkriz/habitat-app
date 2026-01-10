/**
 * Excuse Management for Habitat
 */

import { prisma } from "./db";
import { ExcuseStatus, type Excuse } from "@prisma/client";
import { isAutoApproved, validateExcuseDates } from "./excuse-rules";
import { getSchoolDaysInRange } from "./school-days";

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

/**
 * Create a new excuse
 */
export async function createExcuse(
  childId: string,
  fromDate: Date,
  toDate: Date,
  reason: string | null,
  submittedById: string
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

  const now = new Date();
  const autoApproved = isAutoApproved(now, normalizedFrom);

  // Create the excuse
  const excuse = await prisma.excuse.create({
    data: {
      childId,
      fromDate: normalizedFrom,
      toDate: normalizedTo,
      reason,
      submittedById,
      autoApproved,
    },
  });

  // Update any existing attendance records in the date range
  const schoolDays = await getSchoolDaysInRange(normalizedFrom, normalizedTo);

  for (const day of schoolDays) {
    await prisma.attendance.updateMany({
      where: {
        childId,
        date: day,
        presence: "ABSENT",
      },
      data: {
        excuseId: excuse.id,
        excuseStatus: autoApproved ? ExcuseStatus.EXCUSED : ExcuseStatus.UNEXCUSED,
      },
    });
  }

  // Create audit log
  await prisma.auditLog.create({
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
        autoApproved,
      },
    },
  });

  return excuse;
}

/**
 * Get excuses for a child
 */
export async function getChildExcuses(
  childId: string,
  limit = 10
): Promise<Excuse[]> {
  return prisma.excuse.findMany({
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
  autoApproved?: boolean;
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

  if (options?.autoApproved !== undefined) {
    where.autoApproved = options.autoApproved;
  }

  return prisma.excuse.findMany({
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
 * Update an excuse (Director only)
 */
export async function updateExcuse(
  excuseId: string,
  updates: {
    fromDate?: Date;
    toDate?: Date;
    reason?: string | null;
    autoApproved?: boolean;
  },
  userId: string
): Promise<Excuse> {
  const current = await prisma.excuse.findUnique({
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
    throw new Error(validation.error);
  }

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: "UPDATE",
      entityType: "Excuse",
      entityId: excuseId,
      previousValue: {
        fromDate: current.fromDate.toISOString(),
        toDate: current.toDate.toISOString(),
        reason: current.reason,
        autoApproved: current.autoApproved,
      },
      newValue: {
        fromDate: newFromDate.toISOString(),
        toDate: newToDate.toISOString(),
        reason: updates.reason !== undefined ? updates.reason : current.reason,
        autoApproved:
          updates.autoApproved !== undefined
            ? updates.autoApproved
            : current.autoApproved,
      },
    },
  });

  // Update the excuse
  const normalizedFrom = new Date(newFromDate);
  normalizedFrom.setHours(0, 0, 0, 0);

  const normalizedTo = new Date(newToDate);
  normalizedTo.setHours(0, 0, 0, 0);

  const updatedExcuse = await prisma.excuse.update({
    where: { id: excuseId },
    data: {
      fromDate: normalizedFrom,
      toDate: normalizedTo,
      reason: updates.reason !== undefined ? updates.reason : current.reason,
      autoApproved:
        updates.autoApproved !== undefined
          ? updates.autoApproved
          : current.autoApproved,
    },
  });

  // Update related attendance records
  const newAutoApproved =
    updates.autoApproved !== undefined ? updates.autoApproved : current.autoApproved;

  const schoolDays = await getSchoolDaysInRange(normalizedFrom, normalizedTo);

  for (const day of schoolDays) {
    await prisma.attendance.updateMany({
      where: {
        childId: current.childId,
        date: day,
        presence: "ABSENT",
        excuseId: excuseId,
      },
      data: {
        excuseStatus: newAutoApproved ? ExcuseStatus.EXCUSED : ExcuseStatus.UNEXCUSED,
      },
    });
  }

  return updatedExcuse;
}

/**
 * Delete an excuse (Director only)
 */
export async function deleteExcuse(excuseId: string, userId: string): Promise<void> {
  const excuse = await prisma.excuse.findUnique({
    where: { id: excuseId },
  });

  if (!excuse) {
    throw new Error("Excuse not found");
  }

  // Create audit log
  await prisma.auditLog.create({
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
        autoApproved: excuse.autoApproved,
      },
    },
  });

  // Update related attendance records to UNEXCUSED
  await prisma.attendance.updateMany({
    where: { excuseId },
    data: {
      excuseId: null,
      excuseStatus: ExcuseStatus.UNEXCUSED,
    },
  });

  // Delete the excuse
  await prisma.excuse.delete({
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
  const parentChild = await prisma.parentChild.findUnique({
    where: {
      parentId_childId: {
        parentId: userId,
        childId,
      },
    },
  });

  return !!parentChild;
}
