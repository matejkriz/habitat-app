import {
  getDayCoverage,
  getDayPartCoverage,
  groupExcusesByChild,
  type CoveringExcuse,
} from "./excuse-coverage";
import { isDefaultClosedDay, toLocalDateKey } from "./school-calendar";
import type { Presence } from "./types";

export { toLocalDateKey };

export type CalendarChild = {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
};

export type CalendarAttendance = {
  readonly childId: string;
  readonly date: Date;
  readonly presence: Presence;
};

export type CalendarExcuse = CoveringExcuse;

export type CalendarClosedDay = {
  readonly date: Date;
  readonly description: string | null;
};

export type CalendarNoLunchDay = {
  readonly date: Date;
};

export type CalendarChildDetail = {
  readonly childId: string;
  readonly name: string;
  readonly reason?: string | null;
};

export type AttendanceCalendarDay = {
  readonly dateKey: string;
  readonly dayNumber: number;
  readonly isToday: boolean;
  readonly isPast: boolean;
  readonly isFuture: boolean;
  readonly isClosed: boolean;
  readonly isLunchCancelled: boolean;
  readonly closedReason: string | null;
  readonly isResolved: boolean;
  readonly counts: {
    readonly expected: number;
    readonly expectedMorning: number;
    readonly expectedAfternoon: number;
    readonly present: number;
    readonly excused: number;
    readonly unexcused: number;
    readonly waiting: number;
    readonly unknown: number;
  };
  readonly children: {
    readonly present: ReadonlyArray<CalendarChildDetail>;
    readonly excused: ReadonlyArray<CalendarChildDetail>;
    readonly unexcused: ReadonlyArray<CalendarChildDetail>;
    readonly waiting: ReadonlyArray<CalendarChildDetail>;
    readonly expected: ReadonlyArray<CalendarChildDetail>;
    readonly unknown: ReadonlyArray<CalendarChildDetail>;
    readonly morningAbsent: ReadonlyArray<CalendarChildDetail>;
    readonly afternoonAbsent: ReadonlyArray<CalendarChildDetail>;
  };
};

export function getAttendanceCalendarStartMonthKey(
  startDate: string | undefined,
): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDate ?? "");
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day
  ) {
    return null;
  }

  return `${match[1]}-${match[2]}`;
}

type BuildAttendanceCalendarInput = {
  readonly month: Date;
  readonly today: Date;
  readonly children: ReadonlyArray<CalendarChild>;
  readonly attendance: ReadonlyArray<CalendarAttendance>;
  readonly excuses: ReadonlyArray<CalendarExcuse>;
  readonly closedDays: ReadonlyArray<CalendarClosedDay>;
  readonly noLunchDays: ReadonlyArray<CalendarNoLunchDay>;
};

function getChildDetail(child: CalendarChild, reason?: string | null): CalendarChildDetail {
  return {
    childId: child.id,
    name: `${child.firstName} ${child.lastName}`,
    ...(reason !== undefined ? { reason } : {}),
  };
}

function buildOpenDay(
  date: Date,
  todayKey: string,
  children: ReadonlyArray<CalendarChild>,
  attendance: ReadonlyArray<CalendarAttendance>,
  excusesByChild: ReadonlyMap<string, CalendarExcuse[]>,
  isLunchCancelled: boolean,
): AttendanceCalendarDay {
  const dateKey = toLocalDateKey(date);
  const isPast = dateKey < todayKey;
  const isFuture = dateKey > todayKey;
  const present: CalendarChildDetail[] = [];
  const excused: CalendarChildDetail[] = [];
  const unexcused: CalendarChildDetail[] = [];
  const waiting: CalendarChildDetail[] = [];
  const expected: CalendarChildDetail[] = [];
  const unknown: CalendarChildDetail[] = [];
  const morningAbsent: CalendarChildDetail[] = [];
  const afternoonAbsent: CalendarChildDetail[] = [];
  let expectedMorning = 0;
  let expectedAfternoon = 0;

  for (const child of children) {
    const record = attendance.find(
      (item) => item.childId === child.id && toLocalDateKey(item.date) === dateKey,
    );
    const childExcuses = excusesByChild.get(child.id) ?? [];
    const coverage = getDayCoverage(childExcuses, date);
    const morning = getDayPartCoverage(childExcuses, date, "MORNING");
    const afternoon = getDayPartCoverage(childExcuses, date, "AFTERNOON");

    if (record?.presence !== "ABSENT" && !morning.covered) expectedMorning += 1;
    if (record?.presence !== "ABSENT" && !afternoon.covered) expectedAfternoon += 1;

    if (morning.covered && !afternoon.covered) {
      morningAbsent.push(getChildDetail(child, morning.excuse?.reason));
    }
    if (afternoon.covered && !morning.covered) {
      afternoonAbsent.push(getChildDetail(child, afternoon.excuse?.reason));
    }

    if (record?.presence === "PRESENT") {
      present.push(getChildDetail(child));
    } else if (coverage.excused) {
      excused.push(getChildDetail(child, coverage.excuse?.reason));
    } else if (record?.presence === "ABSENT") {
      unexcused.push(getChildDetail(child));
    } else if (isPast) {
      unknown.push(getChildDetail(child));
    } else if (isFuture) {
      expected.push(getChildDetail(child));
    } else {
      waiting.push(getChildDetail(child));
    }
  }

  const expectedCount = isPast
    ? present.length
    : present.length + waiting.length + expected.length;

  return {
    dateKey,
    dayNumber: date.getDate(),
    isToday: dateKey === todayKey,
    isPast,
    isFuture,
    isClosed: false,
    isLunchCancelled,
    closedReason: null,
    isResolved: isFuture || (waiting.length === 0 && unknown.length === 0),
    counts: {
      expected: expectedCount,
      expectedMorning,
      expectedAfternoon,
      present: present.length,
      excused: excused.length,
      unexcused: unexcused.length,
      waiting: waiting.length,
      unknown: unknown.length,
    },
    children: {
      present,
      excused,
      unexcused,
      waiting,
      expected,
      unknown,
      morningAbsent,
      afternoonAbsent,
    },
  };
}

function buildClosedDay(
  date: Date,
  todayKey: string,
  closedReason: string | null,
): AttendanceCalendarDay {
  const dateKey = toLocalDateKey(date);
  return {
    dateKey,
    dayNumber: date.getDate(),
    isToday: dateKey === todayKey,
    isPast: dateKey < todayKey,
    isFuture: dateKey > todayKey,
    isClosed: true,
    isLunchCancelled: false,
    closedReason,
    isResolved: true,
    counts: {
      expected: 0,
      expectedMorning: 0,
      expectedAfternoon: 0,
      present: 0,
      excused: 0,
      unexcused: 0,
      waiting: 0,
      unknown: 0,
    },
    children: {
      present: [],
      excused: [],
      unexcused: [],
      waiting: [],
      expected: [],
      unknown: [],
      morningAbsent: [],
      afternoonAbsent: [],
    },
  };
}

export function buildAttendanceCalendar({
  month,
  today,
  children,
  attendance,
  excuses,
  closedDays,
  noLunchDays,
}: BuildAttendanceCalendarInput): ReadonlyArray<AttendanceCalendarDay> {
  const todayKey = toLocalDateKey(today);
  const excusesByChild = groupExcusesByChild(excuses);
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const dayCount = new Date(year, monthIndex + 1, 0).getDate();
  const noLunchDateKeys = new Set(noLunchDays.map((day) => toLocalDateKey(day.date)));

  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(year, monthIndex, index + 1);
    const customClosedDay = closedDays.find(
      (closedDay) => toLocalDateKey(closedDay.date) === toLocalDateKey(date),
    );

    if (isDefaultClosedDay(date) || customClosedDay) {
      return buildClosedDay(date, todayKey, customClosedDay?.description ?? null);
    }

    return buildOpenDay(
      date,
      todayKey,
      children,
      attendance,
      excusesByChild,
      noLunchDateKeys.has(toLocalDateKey(date)),
    );
  });
}
