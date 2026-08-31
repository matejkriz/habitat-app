import { describe, expect, it } from "vitest";
import {
  excusesDay,
  getDayCoverage,
  getExcuseDayState,
  getExcuseRangeState,
  getExcuseStatusForDay,
  getLateDays,
  groupExcusesByChild,
  isLateForDay,
  type CoveringExcuse,
} from "./excuse-coverage";
import { getLunchStatus, isPayableLunch, LunchStatus } from "./lunches";
import { ExcuseStatus, Presence } from "./types";

// August 2026: 19. is a Wednesday and 20. a Thursday, so both are school days.
// 21.-23. is the Friday-to-Sunday closure.
const AUG = (day: number, hour = 0, minute = 0) => new Date(2026, 7, day, hour, minute);

const excuse = (overrides: Partial<CoveringExcuse> = {}): CoveringExcuse => ({
  id: "excuse-1",
  childId: "tobias",
  fromDate: AUG(19),
  toDate: AUG(26),
  reason: null,
  submittedAt: AUG(18, 10),
  lateApprovedAt: null,
  ...overrides,
});

describe("per-day lateness", () => {
  it("applies the deadline to each day instead of the start of the range", () => {
    // Submitted after 9:00 on 18. 8., so only 19. 8. missed its deadline.
    const holiday = excuse({ submittedAt: AUG(18, 10) });

    expect(isLateForDay(holiday, AUG(19))).toBe(true);
    expect(isLateForDay(holiday, AUG(20))).toBe(false);
    expect(isLateForDay(holiday, AUG(26))).toBe(false);
  });

  it("reports late days as the leading school days of the range", () => {
    const backdated = excuse({ submittedAt: AUG(19, 14) });

    expect(getLateDays(backdated)).toEqual([AUG(19), AUG(20)]);
  });

  it("reports no late days when the whole range was submitted in time", () => {
    expect(getLateDays(excuse({ submittedAt: AUG(10, 8) }))).toEqual([]);
  });

  it("ignores configured school closures when deriving late days", () => {
    const backdated = excuse({ submittedAt: AUG(19, 14) });
    const openSchoolDays = [AUG(20), AUG(24), AUG(25), AUG(26)];

    expect(getLateDays(backdated, openSchoolDays)).toEqual([AUG(20)]);
  });

  it("distinguishes an approved late day from an on-time excuse", () => {
    const approvedLate = excuse({
      fromDate: AUG(19),
      toDate: AUG(19),
      submittedAt: AUG(19, 14),
      lateApprovedAt: AUG(20, 12),
    });

    expect(getExcuseDayState([approvedLate], AUG(19))).toBe("LATE_APPROVED");
    expect(getExcuseDayState([excuse({ submittedAt: AUG(10, 8) })], AUG(19))).toBe(
      "ON_TIME",
    );
  });
});

describe("overlapping excuses", () => {
  // The regression: a director approved a one-day excuse for 20. 8. while an
  // older, still-late excuse covered 19.-26. 8. The day used to keep the older
  // excuse's state because attendance pointed at a single excuse.
  const stillLate = excuse({
    id: "excuse-old",
    fromDate: AUG(19),
    toDate: AUG(26),
    submittedAt: AUG(19, 14),
  });
  const approved = excuse({
    id: "excuse-approved",
    fromDate: AUG(20),
    toDate: AUG(20),
    submittedAt: AUG(20, 8),
    lateApprovedAt: AUG(20, 12),
  });

  it("excuses a day approved by one excuse while another still covers it late", () => {
    expect(getDayCoverage([stillLate, approved], AUG(20))).toMatchObject({
      covered: true,
      excused: true,
    });
  });

  it("does not depend on the order the excuses arrive in", () => {
    expect(getDayCoverage([approved, stillLate], AUG(20)).excused).toBe(true);
    expect(getDayCoverage([stillLate, approved], AUG(20)).excused).toBe(true);
  });

  it("leaves the days only the late excuse covers unexcused", () => {
    expect(getDayCoverage([stillLate, approved], AUG(19))).toMatchObject({
      covered: true,
      excused: false,
    });
  });

  it("cannot downgrade an excused day by adding another late excuse", () => {
    const onTime = excuse({ id: "excuse-on-time", submittedAt: AUG(10, 8) });
    const late = excuse({ id: "excuse-late", submittedAt: AUG(19, 14) });

    expect(getDayCoverage([onTime], AUG(19)).excused).toBe(true);
    expect(getDayCoverage([onTime, late], AUG(19)).excused).toBe(true);
  });

  it("keeps a day excused once an overlapping excuse is removed", () => {
    const onTime = excuse({ id: "excuse-on-time", submittedAt: AUG(10, 8) });
    const late = excuse({ id: "excuse-late", submittedAt: AUG(19, 14) });

    expect(getDayCoverage([onTime, late].slice(1), AUG(19)).excused).toBe(false);
    expect(getDayCoverage([onTime, late].slice(0, 1), AUG(19)).excused).toBe(true);
  });

  it("names the excuse that excuses the day, not merely the first one stored", () => {
    expect(getDayCoverage([stillLate, approved], AUG(20)).excuse?.id).toBe(
      "excuse-approved",
    );
  });

  it("keeps each child's excuses separate", () => {
    const byChild = groupExcusesByChild([
      stillLate,
      excuse({ id: "excuse-other", childId: "adela" }),
    ]);

    expect(byChild.get("tobias")?.map((item) => item.id)).toEqual(["excuse-old"]);
    expect(byChild.get("adela")?.map((item) => item.id)).toEqual(["excuse-other"]);
  });
});

describe("director decision", () => {
  it("forgives every late day the excuse covers", () => {
    const backdated = excuse({ submittedAt: AUG(19, 14) });
    const forgiven = { ...backdated, lateApprovedAt: AUG(21, 9) };

    expect(getLateDays(backdated).every((day) => !excusesDay(backdated, day))).toBe(
      true,
    );
    expect(getLateDays(forgiven).every((day) => excusesDay(forgiven, day))).toBe(true);
  });

  it("reports the three states the director's list distinguishes", () => {
    expect(getExcuseRangeState(excuse({ submittedAt: AUG(10, 8) }))).toBe("ON_TIME");
    expect(getExcuseRangeState(excuse({ submittedAt: AUG(19, 14) }))).toBe("LATE");
    expect(
      getExcuseRangeState(
        excuse({ submittedAt: AUG(19, 14), lateApprovedAt: AUG(21, 9) }),
      ),
    ).toBe("LATE_APPROVED");
  });
});

describe("lunch consequences", () => {
  const stillLate = excuse({ id: "excuse-old", submittedAt: AUG(19, 14) });
  const approved = excuse({
    id: "excuse-approved",
    fromDate: AUG(20),
    toDate: AUG(20),
    submittedAt: AUG(20, 8),
    lateApprovedAt: AUG(20, 12),
  });
  const absent = { presence: Presence.ABSENT };

  it("shows an approved absence as excused and does not charge for the lunch", () => {
    const coverage = getDayCoverage([stillLate, approved], AUG(20));

    expect(getLunchStatus(absent, coverage)).toBe(LunchStatus.EXCUSED);
    expect(isPayableLunch(getLunchStatus(absent, coverage))).toBe(false);
    expect(getExcuseStatusForDay(Presence.ABSENT, coverage)).toBe(
      ExcuseStatus.EXCUSED,
    );
  });

  it("still charges for a day that is only covered by a late excuse", () => {
    const coverage = getDayCoverage([stillLate, approved], AUG(19));

    expect(getLunchStatus(absent, coverage)).toBe(LunchStatus.LATE);
    expect(isPayableLunch(getLunchStatus(absent, coverage))).toBe(true);
  });

  it("charges for an absence no excuse covers", () => {
    const coverage = getDayCoverage([], AUG(19));

    expect(getLunchStatus(absent, coverage)).toBe(LunchStatus.UNEXCUSED);
    expect(isPayableLunch(getLunchStatus(absent, coverage))).toBe(true);
  });
});
