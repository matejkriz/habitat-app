/**
 * Attendance Business Logic for Habitat
 */

import { db } from "./db";
import { Presence, type Attendance } from "./types";
import { isClosedDay, getSchoolDaysInRange } from "./school-days";
import { getDayCoverage, toDayKey } from "./excuse-coverage";
import { getExcusesOverlapping } from "./excuse";

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
  return db.attendance.list({
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

  return db.attendance.list({
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

  // Excuse state is derived from the excuses themselves, never stored here.
  return db.attendance.save({
    where: {
      childId_date: {
        childId,
        date: normalizedDate,
      },
    },
    update: {
      presence,
      recordedById,
    },
    create: {
      childId,
      date: normalizedDate,
      presence,
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
  const [schoolDays, attendance, excuses] = await Promise.all([
    getSchoolDaysInRange(startDate, endDate),
    getChildAttendance(childId, startDate, endDate),
    getExcusesOverlapping({ childId, from: startDate, to: endDate }),
  ]);

  const attendanceMap = new Map(attendance.map((a) => [toDayKey(a.date), a]));

  let presentDays = 0;
  let absentDays = 0;
  let excusedDays = 0;
  let unexcusedDays = 0;

  for (const day of schoolDays) {
    const record = attendanceMap.get(toDayKey(day));
    if (!record) continue;

    if (record.presence === Presence.PRESENT) {
      presentDays++;
    } else {
      absentDays++;
      if (getDayCoverage(excuses, day).excused) {
        excusedDays++;
      } else {
        unexcusedDays++;
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

  const attendance = await db.attendance.get({
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
