/**
 * Derived excuse coverage.
 *
 * Attendance stores only presence. Whether an absence is excused is computed
 * from the excuses covering that day, so there is no cached state that could
 * drift from the excuses it was derived from.
 *
 * Two rules carry the whole model:
 *
 * 1. Lateness is a property of a *day*, not of an excuse. An excuse submitted
 *    at 10:00 on 18. 8. for 19.-26. 8. misses the deadline only for 19. 8.;
 *    the kitchen can still cancel the remaining lunches in time.
 * 2. A day is excused if *any* covering excuse excuses it. Overlapping excuses
 *    are OR-ed rather than ranked, so no ordering rule can be forgotten and
 *    adding an excuse can never downgrade a day.
 */

import { isAutoApproved } from "./excuse-rules";
import { isDefaultClosedDay, toLocalDateKey } from "./school-calendar";
import {
  ExcuseStatus,
  ExcuseDayPart,
  Presence,
  type ExcuseStatus as ExcuseStatusValue,
  type ExcuseDayPart as ExcuseDayPartValue,
  type Presence as PresenceValue,
} from "./types";

export type CoveringExcuse = {
  readonly id: string;
  readonly childId: string;
  readonly fromDate: Date;
  readonly toDate: Date;
  readonly reason?: string | null;
  /** Missing on legacy records means that the whole day is covered. */
  readonly dayPart?: ExcuseDayPartValue;
  /** Missing on legacy records means that lunch cancellation was requested. */
  readonly cancelLunch?: boolean;
  readonly submittedAt: Date;
  readonly lateApprovedAt: Date | null;
};

export type DayCoverage = {
  /** An excuse spans this day, regardless of whether it excuses it. */
  readonly covered: boolean;
  /** The absence counts as excused: on time for this day, or approved by the director. */
  readonly excused: boolean;
  /** At least one effective covering excuse also cancels lunch for this day. */
  readonly lunchCancelled: boolean;
  /** The excuse that best explains the day, for showing its reason. */
  readonly excuse: CoveringExcuse | null;
};

export const NO_COVERAGE: DayCoverage = {
  covered: false,
  excused: false,
  lunchCancelled: false,
  excuse: null,
};

export type ExcuseRangeState = "ON_TIME" | "LATE" | "LATE_APPROVED";
export type ExcuseDayState = ExcuseRangeState;

export const toDayKey = toLocalDateKey;

export function coversDay(excuse: CoveringExcuse, day: Date): boolean {
  const key = toDayKey(day);
  return toDayKey(excuse.fromDate) <= key && toDayKey(excuse.toDate) >= key;
}

/** The 9:00-the-day-before deadline is evaluated against the day itself. */
export function isLateForDay(excuse: CoveringExcuse, day: Date): boolean {
  return !isAutoApproved(excuse.submittedAt, day);
}

export function excusesDay(excuse: CoveringExcuse, day: Date): boolean {
  return !isLateForDay(excuse, day) || excuse.lateApprovedAt !== null;
}

export function getExcuseDayState(
  excuses: ReadonlyArray<CoveringExcuse>,
  day: Date,
): ExcuseDayState | null {
  const covering = excuses.filter((excuse) => coversDay(excuse, day));
  if (covering.length === 0) return null;
  if (covering.some((excuse) => !isLateForDay(excuse, day))) return "ON_TIME";
  if (covering.some((excuse) => excuse.lateApprovedAt !== null)) {
    return "LATE_APPROVED";
  }
  return "LATE";
}

/**
 * Stable ordering so the reason shown for a day does not depend on storage
 * order. The earliest submission wins; ties break on id.
 */
const bySubmission = (a: CoveringExcuse, b: CoveringExcuse): number =>
  a.submittedAt.getTime() - b.submittedAt.getTime() || a.id.localeCompare(b.id);

export function getDayCoverage(
  excuses: ReadonlyArray<CoveringExcuse>,
  day: Date,
): DayCoverage {
  const morning = getDayPartCoverage(excuses, day, ExcuseDayPart.MORNING);
  const afternoon = getDayPartCoverage(excuses, day, ExcuseDayPart.AFTERNOON);
  if (!morning.covered || !afternoon.covered) return NO_COVERAGE;

  const covering = excuses.filter((excuse) => coversDay(excuse, day));
  const excusing = covering.filter((excuse) => excusesDay(excuse, day));
  const lunchCancelling = excusing.filter((excuse) => excuse.cancelLunch !== false);
  const fullyExcused = morning.excused && afternoon.excused;
  const nonExcusing = covering.filter((excuse) => !excusesDay(excuse, day));
  const relevant = fullyExcused ? excusing : nonExcusing;

  return {
    covered: true,
    excused: fullyExcused,
    lunchCancelled: lunchCancelling.length > 0,
    excuse: [...relevant].sort(bySubmission)[0],
  };
}

function coversDayPart(
  excuse: CoveringExcuse,
  dayPart: Exclude<ExcuseDayPartValue, "FULL_DAY">,
): boolean {
  return (
    excuse.dayPart === undefined ||
    excuse.dayPart === ExcuseDayPart.FULL_DAY ||
    excuse.dayPart === dayPart
  );
}

export function getDayPartCoverage(
  excuses: ReadonlyArray<CoveringExcuse>,
  day: Date,
  dayPart: Exclude<ExcuseDayPartValue, "FULL_DAY">,
): DayCoverage {
  const covering = excuses.filter(
    (excuse) => coversDay(excuse, day) && coversDayPart(excuse, dayPart),
  );
  if (covering.length === 0) return NO_COVERAGE;

  const excusing = covering.filter((excuse) => excusesDay(excuse, day));
  const lunchCancelling = excusing.filter(
    (excuse) => excuse.cancelLunch !== false,
  );
  const relevant = excusing.length > 0 ? excusing : covering;

  return {
    covered: true,
    excused: excusing.length > 0,
    lunchCancelled: lunchCancelling.length > 0,
    excuse: [...relevant].sort(bySubmission)[0],
  };
}

export function getExcuseDayPartState(
  excuses: ReadonlyArray<CoveringExcuse>,
  day: Date,
  dayPart: Exclude<ExcuseDayPartValue, "FULL_DAY">,
): ExcuseDayState | null {
  return getExcuseDayState(
    excuses.filter((excuse) => coversDayPart(excuse, dayPart)),
    day,
  );
}

export function groupExcusesByChild(
  excuses: ReadonlyArray<CoveringExcuse>,
): Map<string, CoveringExcuse[]> {
  const byChild = new Map<string, CoveringExcuse[]>();
  for (const excuse of excuses) {
    const bucket = byChild.get(excuse.childId);
    if (bucket) {
      bucket.push(excuse);
    } else {
      byChild.set(excuse.childId, [excuse]);
    }
  }
  return byChild;
}

export function getExcuseStatusForDay(
  presence: PresenceValue,
  coverage: DayCoverage,
): ExcuseStatusValue {
  if (presence === Presence.PRESENT) return ExcuseStatus.NONE;
  return coverage.excused ? ExcuseStatus.EXCUSED : ExcuseStatus.UNEXCUSED;
}

/**
 * School days in the excuse range whose deadline had already passed when the
 * excuse was submitted. Because the submission is a single instant, these are
 * always the leading days of the range.
 *
 * Callers that know the configured school calendar pass its open school days.
 * Pure callers may omit them and get the default Monday-to-Thursday calendar.
 */
export function getLateDays(
  excuse: CoveringExcuse,
  schoolDays?: ReadonlyArray<Date>,
): Date[] {
  if (schoolDays) {
    return schoolDays
      .filter((day) => coversDay(excuse, day) && isLateForDay(excuse, day))
      .map((day) => new Date(day));
  }

  const lateDays: Date[] = [];
  const current = new Date(excuse.fromDate);
  current.setHours(0, 0, 0, 0);

  const end = new Date(excuse.toDate);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    if (!isDefaultClosedDay(current) && isLateForDay(excuse, current)) {
      lateDays.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return lateDays;
}

export function getExcuseRangeState(
  excuse: CoveringExcuse,
  schoolDays?: ReadonlyArray<Date>,
): ExcuseRangeState {
  if (getLateDays(excuse, schoolDays).length === 0) return "ON_TIME";
  return excuse.lateApprovedAt !== null ? "LATE_APPROVED" : "LATE";
}

/** True once the director has nothing left to decide about this excuse. */
export function isExcuseSettled(
  excuse: CoveringExcuse,
  schoolDays?: ReadonlyArray<Date>,
): boolean {
  return getExcuseRangeState(excuse, schoolDays) !== "LATE";
}
