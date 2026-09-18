import { describe, expect, it } from "vitest";
import { previousSchoolDay } from "./e2e-date.mjs";

describe("previousSchoolDay", () => {
  it.each([
    ["Friday", "2026-09-18T10:00:00Z", "2026-09-17"],
    ["Saturday", "2026-09-19T10:00:00Z", "2026-09-17"],
    ["Sunday", "2026-09-20T10:00:00Z", "2026-09-17"],
    ["Monday", "2026-09-21T10:00:00Z", "2026-09-17"],
    ["Tuesday", "2026-09-22T10:00:00Z", "2026-09-21"],
  ])("returns the prior open day on %s", (_day, now, expected) => {
    expect(previousSchoolDay(new Date(now))).toBe(expected);
  });
});
