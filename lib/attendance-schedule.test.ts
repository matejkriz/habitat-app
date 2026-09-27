import { describe, expect, it } from "vitest";
import { getChildDayPlan, getAttendanceDays, hasPartialAttendance, parseAttendanceDays } from "./attendance-schedule";
import { getDayCoverage, getDayPartCoverage, type CoveringExcuse } from "./excuse-coverage";
import { getMakeupLunchDeadline, isMakeupLunchOnTime } from "./makeup-rules";

const tuesday = new Date(2026, 8, 29);
const child = { attendanceDays: [1, 3, 4] };
const makeup = (overrides: Partial<CoveringExcuse> = {}): CoveringExcuse => ({
  id: "makeup", childId: "child", kind: "MAKEUP", fromDate: tuesday, toDate: tuesday,
  submittedAt: new Date(2026, 8, 28, 8), lateApprovedAt: null, ...overrides,
});

describe("regular attendance and makeup days", () => {
  it("preserves all four days for legacy children and distinguishes an empty schedule", () => {
    expect(getAttendanceDays({})).toEqual([1, 2, 3, 4]);
    expect(hasPartialAttendance({})).toBe(false);
    expect(getAttendanceDays({ attendanceDays: [] })).toEqual([]);
    expect(hasPartialAttendance({ attendanceDays: [] })).toBe(true);
  });
  it("validates selected school weekdays", () => {
    expect(parseAttendanceDays([4, 1])).toEqual([1, 4]);
    expect(() => parseAttendanceDays([1, 1])).toThrow();
    expect(() => parseAttendanceDays([5])).toThrow();
  });
  it("removes an unscheduled day from expected children and lunches", () => {
    expect(getChildDayPlan(child, [], tuesday)).toMatchObject({
      scheduled: false, notScheduled: true, expectedMorning: false, expectedAfternoon: false, lunchEnrolled: false,
    });
  });
  it("adds a timely makeup to attendance and lunches without excusing the child", () => {
    expect(getChildDayPlan(child, [makeup()], tuesday)).toMatchObject({
      makeup: true, notScheduled: false, expectedMorning: true, expectedAfternoon: true, lunchEnrolled: true,
    });
    expect(getDayCoverage([makeup()], tuesday).covered).toBe(false);
    expect(getDayPartCoverage([makeup()], tuesday, "MORNING").covered).toBe(false);
  });
  it("accepts a late makeup arrival but does not enroll its lunch until approval", () => {
    const late = makeup({ submittedAt: new Date(2026, 8, 28, 10) });
    expect(getChildDayPlan(child, [late], tuesday)).toMatchObject({ makeup: true, expectedMorning: true, lunchEnrolled: false, makeupLate: true });
    expect(getChildDayPlan(child, [{ ...late, lateApprovedAt: tuesday }], tuesday).lunchEnrolled).toBe(true);
  });
  it("supports afternoon-only arrivals without a lunch", () => {
    expect(getChildDayPlan(child, [makeup({ dayPart: "AFTERNOON" })], tuesday)).toMatchObject({ expectedMorning: false, expectedAfternoon: true, lunchEnrolled: false, makeupLate: false });
  });
  it("removes a notified late absence from staff planning before lunch approval", () => {
    const lateAbsence = makeup({ kind: "EXCUSE", dayPart: "MORNING", submittedAt: tuesday });
    expect(getChildDayPlan({}, [lateAbsence], tuesday)).toMatchObject({ expectedMorning: false, expectedAfternoon: true, lunchEnrolled: true });
  });
  it("retains excuse coverage for a cancelled makeup", () => {
    const excuse = makeup({ id: "excuse", kind: "EXCUSE", cancelLunch: true });
    expect(getChildDayPlan(child, [makeup(), excuse], tuesday)).toMatchObject({ expectedMorning: false, expectedAfternoon: false, lunchEnrolled: false });
  });
  it("ignores makeup records on ordinary scheduled days and school closures", () => {
    expect(getChildDayPlan({}, [makeup({ dayPart: "AFTERNOON" })], tuesday)).toMatchObject({ scheduled: true, makeup: false, expectedMorning: true, expectedAfternoon: true });
    expect(getChildDayPlan({}, [], new Date(2026, 9, 2))).toMatchObject({ expectedMorning: false, expectedAfternoon: false, lunchEnrolled: false });
  });
});

describe("makeup lunch cutoff", () => {
  it("uses the preceding calendar day for Mondays", () => {
    const monday = new Date(2026, 8, 28);
    expect(getMakeupLunchDeadline(monday)).toEqual(new Date("2026-09-27T07:00:00Z"));
    expect(isMakeupLunchOnTime(new Date("2026-09-27T06:59:59Z"), monday)).toBe(true);
    expect(isMakeupLunchOnTime(new Date("2026-09-27T07:00:00Z"), monday)).toBe(false);
  });
  it("calculates the Prague cutoff across daylight saving time", () => {
    expect(getMakeupLunchDeadline(new Date(2026, 9, 26))).toEqual(new Date("2026-10-25T08:00:00Z"));
    expect(getMakeupLunchDeadline(new Date(2026, 2, 30))).toEqual(new Date("2026-03-29T07:00:00Z"));
  });
});
