import { describe, expect, it } from "vitest";
import { Presence } from "./types";
import { NO_COVERAGE, type DayCoverage } from "./excuse-coverage";
import {
  getLocalDateKey,
  getLunchStatus,
  isPayableLunch,
  LunchStatus,
  sortChildrenWithSiblings,
} from "./lunches";

const coverage = (excused: boolean): DayCoverage => ({
  covered: true,
  excused,
  excuse: null,
});

describe("lunch overview", () => {
  it.each([
    [Presence.PRESENT, NO_COVERAGE, LunchStatus.PRESENT, true],
    [Presence.ABSENT, coverage(true), LunchStatus.EXCUSED, false],
    [Presence.ABSENT, coverage(false), LunchStatus.LATE, true],
    [Presence.ABSENT, NO_COVERAGE, LunchStatus.UNEXCUSED, true],
  ])(
    "classifies attendance and payment",
    (presence, dayCoverage, expectedStatus, expectedPayable) => {
      const status = getLunchStatus({ presence }, dayCoverage);

      expect(status).toBe(expectedStatus);
      expect(isPayableLunch(status)).toBe(expectedPayable);
    },
  );

  it("leaves a day without attendance unmarked and unpaid", () => {
    expect(getLunchStatus(undefined, NO_COVERAGE)).toBeNull();
    expect(isPayableLunch(null)).toBe(false);
  });

  it("keeps siblings together even when their surnames differ", () => {
    const sorted = sortChildrenWithSiblings([
      { id: "1", firstName: "Adam", lastName: "Bílý", parentIds: ["parent-a"] },
      { id: "2", firstName: "Cyril", lastName: "Černý", parentIds: [] },
      { id: "3", firstName: "Ema", lastName: "Dlouhá", parentIds: ["parent-a"] },
      { id: "4", firstName: "Anna", lastName: "Ábelová", parentIds: [] },
    ]);

    expect(sorted.map((child) => child.id)).toEqual(["4", "1", "3", "2"]);
  });

  it("formats dates from local calendar values", () => {
    expect(getLocalDateKey(new Date(2026, 7, 3))).toBe("2026-08-03");
  });
});
