import type { ExcuseStatus, Presence } from "./types";

export type CalendarChild = {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
};

export type CalendarAttendance = {
  readonly childId: string;
  readonly date: Date;
  readonly presence: Presence;
  readonly excuseStatus: ExcuseStatus;
};

export type CalendarExcuse = {
  readonly childId: string;
  readonly fromDate: Date;
  readonly toDate: Date;
  readonly reason: string | null;
};

export type CalendarClosedDay = {
  readonly date: Date;
  readonly description: string | null;
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
  readonly closedReason: string | null;
  readonly isResolved: boolean;
  readonly counts: {
    readonly expected: number;
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
  };
};

type BuildAttendanceCalendarInput = {
  readonly month: Date;
  readonly today: Date;
  readonly children: ReadonlyArray<CalendarChild>;
  readonly attendance: ReadonlyArray<CalendarAttendance>;
  readonly excuses: ReadonlyArray<CalendarExcuse>;
  readonly closedDays: ReadonlyArray<CalendarClosedDay>;
};

export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isDefaultClosedDay(date: Date): boolean {
  return date.getDay() === 0 || date.getDay() >= 5;
}

function getChildDetail(child: CalendarChild, reason?: string | null): CalendarChildDetail {
  return {
    childId: child.id,
    name: `${child.firstName} ${child.lastName}`,
    ...(reason !== undefined ? { reason } : {}),
  };
}

function isDateInExcuse(date: Date, excuse: CalendarExcuse): boolean {
  const dateKey = toLocalDateKey(date);
  return dateKey >= toLocalDateKey(excuse.fromDate) && dateKey <= toLocalDateKey(excuse.toDate);
}

function buildOpenDay(
  date: Date,
  todayKey: string,
  children: ReadonlyArray<CalendarChild>,
  attendance: ReadonlyArray<CalendarAttendance>,
  excuses: ReadonlyArray<CalendarExcuse>,
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

  for (const child of children) {
    const record = attendance.find(
      (item) => item.childId === child.id && toLocalDateKey(item.date) === dateKey,
    );
    const excuse = excuses.find(
      (item) => item.childId === child.id && isDateInExcuse(date, item),
    );

    if (record?.presence === "PRESENT") {
      present.push(getChildDetail(child));
    } else if (record?.excuseStatus === "EXCUSED" || (!record && excuse)) {
      excused.push(getChildDetail(child, excuse?.reason));
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
    closedReason: null,
    isResolved: isFuture || (waiting.length === 0 && unknown.length === 0),
    counts: {
      expected: expectedCount,
      present: present.length,
      excused: excused.length,
      unexcused: unexcused.length,
      waiting: waiting.length,
      unknown: unknown.length,
    },
    children: { present, excused, unexcused, waiting, expected, unknown },
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
    closedReason,
    isResolved: true,
    counts: { expected: 0, present: 0, excused: 0, unexcused: 0, waiting: 0, unknown: 0 },
    children: { present: [], excused: [], unexcused: [], waiting: [], expected: [], unknown: [] },
  };
}

export function buildAttendanceCalendar({
  month,
  today,
  children,
  attendance,
  excuses,
  closedDays,
}: BuildAttendanceCalendarInput): ReadonlyArray<AttendanceCalendarDay> {
  const todayKey = toLocalDateKey(today);
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const dayCount = new Date(year, monthIndex + 1, 0).getDate();

  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(year, monthIndex, index + 1);
    const customClosedDay = closedDays.find(
      (closedDay) => toLocalDateKey(closedDay.date) === toLocalDateKey(date),
    );

    if (isDefaultClosedDay(date) || customClosedDay) {
      return buildClosedDay(date, todayKey, customClosedDay?.description ?? null);
    }

    return buildOpenDay(date, todayKey, children, attendance, excuses);
  });
}
