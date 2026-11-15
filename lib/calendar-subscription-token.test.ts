import { afterEach, expect, it, vi } from "vitest";
import { calendarSigningKeyId, calendarSubscriptionToken, hashCalendarToken, newCalendarSubscription } from "./calendar-subscription-token";

afterEach(() => vi.unstubAllEnvs());
it("recovers tokens with the same key, separates key IDs from tokens and changes both when the signing key changes", () => {
  vi.stubEnv("PUSH_INTERNAL_SECRET", "first-signing-key");
  const created = newCalendarSubscription();
  const token = calendarSubscriptionToken(created.nonce);
  const keyId = calendarSigningKeyId();
  expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(created.tokenHash).toBe(hashCalendarToken(token));
  expect(keyId).toMatch(/^[a-f0-9]{64}$/);
  expect(keyId).not.toBe(created.tokenHash);
  expect(calendarSubscriptionToken(created.nonce)).toBe(token);
  expect(newCalendarSubscription().nonce).not.toBe(created.nonce);
  vi.stubEnv("PUSH_INTERNAL_SECRET", "replacement-signing-key");
  expect(calendarSubscriptionToken(created.nonce)).not.toBe(token);
  expect(calendarSigningKeyId()).not.toBe(keyId);
});
