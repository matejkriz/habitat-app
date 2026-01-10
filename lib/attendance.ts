/**
 * Attendance Business Logic for Habitat
 */

import { prisma } from "./db";
import { Presence, ExcuseStatus, type Attendance } from "@prisma/client";
import { isClosedDay, getSchoolDaysInRange } from "./school-days";

export type AttendanceWithChild = Attendance & {
  child: {
    id: string;
    firstName: string;
    lastName: string;
  };
};

/**
 * Get attendance records for a child in a date range
 */
export async function getChildAttendance(
  childId: string,
  startDate: Date,
  endDate: Date
): Promise<Attendance[]> {
  return prisma.attendance.findMany({
    where: {
      childId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { date: "desc" },
  });
}

/**
 * Get attendance for a specific day for all children
 */
export async function getDailyAttendance(date: Date): Promise<AttendanceWithChild[]> {
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);

  return prisma.attendance.findMany({
    where: {
      date: normalizedDate,
    },
    include: {
      child: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: {
      child: {
        lastName: "asc",
      },
    },
  });
}

/**
 * Record or update attendance for a child on a specific day
 */
export async function recordAttendance(
  childId: string,
  date: Date,
  presence: Presence,
  recordedById: string
): Promise<Attendance> {
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);

  // Check if there's an existing excuse covering this date
  const excuse = await prisma.excuse.findFirst({
    where: {
      childId,
      fromDate: { lte: normalizedDate },
      toDate: { gte: normalizedDate },
    },
  });

  // Determine excuse status
  let excuseStatus: ExcuseStatus = ExcuseStatus.NONE;
  if (presence === Presence.ABSENT) {
    if (excuse) {
      excuseStatus = excuse.autoApproved
        ? ExcuseStatus.EXCUSED
        : ExcuseStatus.UNEXCUSED;
    } else {
      excuseStatus = ExcuseStatus.UNEXCUSED;
    }
  }

  return prisma.attendance.upsert({
    where: {
      childId_date: {
        childId,
        date: normalizedDate,
      },
    },
    update: {
      presence,
      excuseStatus,
      excuseId: excuse?.id || null,
      recordedById,
    },
    create: {
      childId,
      date: normalizedDate,
      presence,
      excuseStatus,
      excuseId: excuse?.id || null,
      recordedById,
    },
  });
}

/**
 * Record attendance for multiple children at once
 */
export async function recordBulkAttendance(
  records: Array<{
    childId: string;
    presence: Presence;
  }>,
  date: Date,
  recordedById: string
): Promise<Attendance[]> {
  const results: Attendance[] = [];

  for (const record of records) {
    const attendance = await recordAttendance(
      record.childId,
      date,
      record.presence,
      recordedById
    );
    results.push(attendance);
  }

  return results;
}

/**
 * Check if attendance can be entered for a date
 */
export async function canEnterAttendance(date: Date): Promise<boolean> {
  // Cannot enter attendance for closed days
  if (await isClosedDay(date)) {
    return false;
  }

  // Cannot enter attendance for future dates
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);

  return normalizedDate <= today;
}

/**
 * Get attendance statistics for a child
 */
export async function getChildAttendanceStats(
  childId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  totalDays: number;
  presentDays: number;
  absentDays: number;
  excusedDays: number;
  unexcusedDays: number;
  attendanceRate: number;
}> {
  const schoolDays = await getSchoolDaysInRange(startDate, endDate);
  const attendance = await getChildAttendance(childId, startDate, endDate);

  const attendanceMap = new Map(
    attendance.map((a) => [a.date.toISOString().split("T")[0], a])
  );

  let presentDays = 0;
  let absentDays = 0;
  let excusedDays = 0;
  let unexcusedDays = 0;

  for (const day of schoolDays) {
    const dateStr = day.toISOString().split("T")[0];
    const record = attendanceMap.get(dateStr);

    if (record) {
      if (record.presence === Presence.PRESENT) {
        presentDays++;
      } else {
        absentDays++;
        if (record.excuseStatus === ExcuseStatus.EXCUSED) {
          excusedDays++;
        } else {
          unexcusedDays++;
        }
      }
    }
  }

  const totalDays = schoolDays.length;
  const attendanceRate = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;

  return {
    totalDays,
    presentDays,
    absentDays,
    excusedDays,
    unexcusedDays,
    attendanceRate: Math.round(attendanceRate * 10) / 10,
  };
}

/**
 * Get today's attendance status for a child
 */
export async function getTodayStatus(childId: string): Promise<{
  isSchoolDay: boolean;
  isClosed: boolean;
  attendance: Attendance | null;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const closed = await isClosedDay(today);

  if (closed) {
    return {
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
    isSchoolDay: true,
    isClosed: false,
    attendance,
  };
}

/**
 * Override excuse status (Director only)
 */
export async function overrideExcuseStatus(
  attendanceId: string,
  newStatus: ExcuseStatus,
  userId: string
): Promise<Attendance> {
  const current = await prisma.attendance.findUnique({
    where: { id: attendanceId },
  });

  if (!current) {
    throw new Error("Attendance record not found");
  }

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: "UPDATE",
      entityType: "Attendance",
      entityId: attendanceId,
      previousValue: { excuseStatus: current.excuseStatus },
      newValue: { excuseStatus: newStatus },
    },
  });

  return prisma.attendance.update({
    where: { id: attendanceId },
    data: { excuseStatus: newStatus },
  });
}
