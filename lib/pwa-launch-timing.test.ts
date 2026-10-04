import { beforeEach, describe, expect, it, vi } from "vitest";
import { consumeLaunchTiming } from "./pwa-launch-timing";

describe("PWA launch timing", () => {
  beforeEach(() => sessionStorage.clear());

  it("reports the shell and navigation delay once without storing account data", () => {
    sessionStorage.setItem("habitat-launch-timing", JSON.stringify({ shellMs: 26, redirectEpochMs: 1000, controlled: true }));
    expect(consumeLaunchTiming(1004)).toEqual({ shellMs: 26, navigationGapMs: 4, addedMs: 30, controlled: true });
    expect(consumeLaunchTiming(1004)).toBeNull();
  });

  it("ignores stale timing from an interrupted previous launch", () => {
    sessionStorage.setItem("habitat-launch-timing", JSON.stringify({ shellMs: 26, redirectEpochMs: 1000, controlled: true }));
    expect(consumeLaunchTiming(62000)).toBeNull();
  });

  it("does not interrupt startup when session storage is unavailable", () => {
    const get = vi.spyOn(sessionStorage, "getItem").mockImplementation(() => { throw new Error("storage denied"); });
    expect(consumeLaunchTiming(1004)).toBeNull();
    get.mockRestore();
  });
});
