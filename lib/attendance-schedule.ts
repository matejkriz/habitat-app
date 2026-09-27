import { coversDay, getDayPartCoverage, type CoveringExcuse } from "./excuse-coverage";
import { isMakeupLunchOnTime } from "./makeup-rules";
import { isDefaultClosedDay } from "./school-calendar";
import { ExcuseDayPart, type ExcuseKind } from "./types";

export const DEFAULT_ATTENDANCE_DAYS = [1, 2, 3, 4] as const;
export type AttendanceSchedule = { readonly attendanceDays?: ReadonlyArray<number> };

export function getAttendanceDays(child: AttendanceSchedule): ReadonlyArray<number> {
  return child.attendanceDays ?? DEFAULT_ATTENDANCE_DAYS;
}

export function parseAttendanceDays(value: unknown): number[] {
  if (!Array.isArray(value) || value.some(day => !Number.isInteger(day) || !DEFAULT_ATTENDANCE_DAYS.includes(day)) || new Set(value).size !== value.length) {
    throw new Error("Neplatné dny docházky.");
  }
  return [...value].sort((a, b) => a - b);
}

export function hasPartialAttendance(child: AttendanceSchedule): boolean {
  return getAttendanceDays(child).length < DEFAULT_ATTENDANCE_DAYS.length;
}

export function isRegularAttendanceDay(child: AttendanceSchedule, day: Date): boolean {
  return getAttendanceDays(child).includes(day.getDay());
}

export function getAttendanceDateDisabledReason(child: AttendanceSchedule, day: Date, kind: ExcuseKind = "EXCUSE"): string | null {
  const scheduled = isRegularAttendanceDay(child, day);
  if (kind === "MAKEUP") return scheduled ? "Dítě tento den běžně chodí." : null;
  return scheduled ? null : "Dítě tento den běžně nechodí.";
}

export type ChildDayPlan = {
  readonly scheduled: boolean;
  readonly expectedMorning: boolean;
  readonly expectedAfternoon: boolean;
  readonly notScheduled: boolean;
  readonly makeup: boolean;
  readonly lunchEnrolled: boolean;
  readonly makeupLate: boolean;
};

export function getChildDayPlan(child: AttendanceSchedule, records: ReadonlyArray<CoveringExcuse>, day: Date): ChildDayPlan {
  const closed = isDefaultClosedDay(day);
  const scheduled = !closed && isRegularAttendanceDay(child, day);
  const makeups = closed || scheduled ? [] : records.filter(record => record.kind === "MAKEUP" && coversDay(record, day));
  const morning = getDayPartCoverage(records, day, ExcuseDayPart.MORNING);
  const afternoon = getDayPartCoverage(records, day, ExcuseDayPart.AFTERNOON);
  const morningMakeups = makeups.filter(record => record.dayPart !== ExcuseDayPart.AFTERNOON);
  const afternoonMakeups = makeups.filter(record => record.dayPart !== ExcuseDayPart.MORNING);
  const timelyLunch = morningMakeups.some(record => isMakeupLunchOnTime(record.submittedAt, day) || record.lateApprovedAt !== null);
  return {
    scheduled,
    expectedMorning: (scheduled || morningMakeups.length > 0) && !morning.covered,
    expectedAfternoon: (scheduled || afternoonMakeups.length > 0) && !afternoon.covered,
    notScheduled: !closed && !scheduled && makeups.length === 0,
    makeup: makeups.length > 0,
    lunchEnrolled: (scheduled || timelyLunch) && !morning.lunchCancelled,
    makeupLate: morningMakeups.length > 0 && !timelyLunch,
  };
}
