import { describe, expect, it } from "vitest";
import {
  getRetryDelayMs,
  isExpiredSubscriptionStatus,
} from "./pushDeliveryPolicy";

describe("push delivery retry policy", () => {
  it("backs off from seconds to days and eventually stops", () => {
    expect(getRetryDelayMs(1)).toBe(15_000);
    expect(getRetryDelayMs(5)).toBe(60 * 60_000);
    expect(getRetryDelayMs(10)).toBe(72 * 60 * 60_000);
    expect(getRetryDelayMs(11)).toBeNull();
  });

  it("removes only subscriptions declared expired by the push service", () => {
    expect(isExpiredSubscriptionStatus(404)).toBe(true);
    expect(isExpiredSubscriptionStatus(410)).toBe(true);
    expect(isExpiredSubscriptionStatus(429)).toBe(false);
    expect(isExpiredSubscriptionStatus(null)).toBe(false);
  });
});
