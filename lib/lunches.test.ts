import { describe, expect, it } from "vitest";
import { ExcuseStatus, Presence } from "./types";
import {
  getLocalDateKey,
  getLunchStatus,
  isPayableLunch,
  LunchStatus,
  sortChildrenWithSiblings,
} from "./lunches";

describe("lunch overview", () => {
  it.each([
    [Presence.PRESENT, ExcuseStatus.NONE, null, LunchStatus.PRESENT, true],
    [Presence.ABSENT, ExcuseStatus.EXCUSED, "excuse-1", LunchStatus.EXCUSED, false],
    [Presence.ABSENT, ExcuseStatus.UNEXCUSED, "excuse-2", LunchStatus.LATE, true],
    [Presence.ABSENT, ExcuseStatus.UNEXCUSED, null, LunchStatus.UNEXCUSED, true],
  ])(
    "classifies attendance and payment",
    (presence, excuseStatus, excuseId, expectedStatus, expectedPayable) => {
      const status = getLunchStatus({ presence, excuseStatus, excuseId });

      expect(status).toBe(expectedStatus);
      expect(isPayableLunch(status)).toBe(expectedPayable);
    },
  );

  it("leaves a day without attendance unmarked and unpaid", () => {
    expect(getLunchStatus(undefined)).toBeNull();
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
