import { getDayCoverage, type CoveringExcuse } from "./excuse-coverage";
import type { Presence } from "./types";
import { isDefaultClosedDay, toLocalDateKey as toKey } from "./school-calendar";

export type ParentCalendarStatus =
  | "EXPECTED"
  | "PRESENT"
  | "EXCUSED"
  | "PENDING"
  | "UNEXCUSED"
  | "MISSING"
  | "CLOSED";

export interface ParentCalendarDay {
  readonly date: string;
  readonly dayNumber: number;
  readonly status: ParentCalendarStatus;
  readonly isToday: boolean;
}

interface CalendarAttendance {
  readonly date: Date;
  readonly presence: Presence;
}

interface BuildParentCalendarMonthInput {
  readonly month: Date;
  readonly attendance: ReadonlyArray<CalendarAttendance>;
  readonly excuses: ReadonlyArray<CoveringExcuse>;
  readonly closedDays: ReadonlyArray<Date>;
  readonly today?: Date;
}

export const toLocalDateKey = toKey;

export function parseMonth(month: string | undefined, fallback = new Date()): Date {
  const match = /^(\d{4})-(\d{2})$/.exec(month ?? "");
  if (!match) return new Date(fallback.getFullYear(), fallback.getMonth(), 1);

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) {
    return new Date(fallback.getFullYear(), fallback.getMonth(), 1);
  }
  return new Date(year, monthIndex, 1);
}

export function buildParentCalendarMonth({
  month,
  attendance,
  excuses,
  closedDays,
  today = new Date(),
}: BuildParentCalendarMonthInput): ReadonlyArray<ParentCalendarDay> {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const attendanceByDate = new Map(attendance.map((item) => [toLocalDateKey(item.date), item]));
  const closedDateKeys = new Set(closedDays.map(toLocalDateKey));
  const todayKey = toLocalDateKey(today);

  return Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(year, monthIndex, index + 1);
    const dateKey = toLocalDateKey(date);
    const attendanceItem = attendanceByDate.get(dateKey);
    const coverage = getDayCoverage(excuses, date);

    let status: ParentCalendarStatus;
    if (isDefaultClosedDay(date) || closedDateKeys.has(dateKey)) {
      status = "CLOSED";
    } else if (attendanceItem?.presence === "PRESENT") {
      status = "PRESENT";
    } else if (coverage.excused) {
      status = "EXCUSED";
    } else if (coverage.covered) {
      status = "PENDING";
    } else if (attendanceItem?.presence === "ABSENT") {
      status = "UNEXCUSED";
    } else if (dateKey < todayKey) {
      status = "MISSING";
    } else {
      status = "EXPECTED";
    }

    return {
      date: dateKey,
      dayNumber: index + 1,
      status,
      isToday: dateKey === todayKey,
    };
  });
}
