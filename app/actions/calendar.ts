"use server";

import { buildAttendanceCalendar, type AttendanceCalendarDay } from "@/lib/attendance-calendar";
import { getDbUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { UserRole, type Attendance, type Child, type ClosedDay, type Excuse } from "@/lib/types";

export type AttendanceCalendarMonth = {
  readonly monthKey: string;
  readonly totalChildren: number;
  readonly days: ReadonlyArray<AttendanceCalendarDay>;
};

function parseMonthKey(monthKey: string): { year: number; monthIndex: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  const year = Number(match?.[1]);
  const monthIndex = Number(match?.[2]) - 1;

  if (!match || year < 2020 || year > 2100 || monthIndex < 0 || monthIndex > 11) {
    throw new Error("Neplatný měsíc");
  }

  return { year, monthIndex };
}

export async function getAttendanceCalendarMonth(
  monthKey: string,
): Promise<AttendanceCalendarMonth> {
  const user = await getDbUser();
  if (!user || (user.role !== UserRole.TEACHER && user.role !== UserRole.DIRECTOR)) {
    throw new Error("Unauthorized");
  }

  const { year, monthIndex } = parseMonthKey(monthKey);
  const startDate = new Date(year, monthIndex, 1);
  const endDate = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

  const [children, attendance, allExcuses, closedDays] = (await Promise.all([
    db.children.list({
      where: { active: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    db.attendance.list({ where: { date: { gte: startDate, lte: endDate } } }),
    db.excuses.list({ where: { fromDate: { lte: endDate } } }),
    db.closedDays.list({ where: { date: { gte: startDate, lte: endDate } } }),
  ])) as [
    ReadonlyArray<Child>,
    ReadonlyArray<Attendance>,
    ReadonlyArray<Excuse>,
    ReadonlyArray<ClosedDay>,
  ];

  const excuses = allExcuses.filter(
    (excuse) => excuse.fromDate <= endDate && excuse.toDate >= startDate,
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return {
    monthKey,
    totalChildren: children.length,
    days: buildAttendanceCalendar({
      month: startDate,
      today,
      children,
      attendance,
      excuses,
      closedDays,
    }),
  };
}
