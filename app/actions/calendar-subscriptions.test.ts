import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), upsert: vi.fn(), revoke: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getDbUser: mocks.user }));
vi.mock("@/lib/db", () => ({ db: { calendarSubscriptions: { upsert: mocks.upsert, revoke: mocks.revoke } } }));
import { getCalendarSubscriptionLinks, revokeCalendarSubscriptionLinks, rotateCalendarSubscriptionLinks } from "./calendar-subscriptions";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("PUSH_INTERNAL_SECRET", "test-signing-key");
  vi.stubEnv("NEXT_PUBLIC_WORKOS_REDIRECT_URI", "https://developapp.habitatzbraslav.cz/callback");
  mocks.user.mockResolvedValue({ id: "current-parent", role: "PARENT" });
  mocks.upsert.mockResolvedValue("n".repeat(43));
});
afterEach(() => vi.unstubAllEnvs());

describe("calendar subscription ownership", () => {
  it("creates/retrieves stable links for the authenticated user without revealing the server secret", async () => {
    const first = await getCalendarSubscriptionLinks();
    const second = await getCalendarSubscriptionLinks();
    expect(first).toEqual(second);
    expect(first.habitat).toMatch(/^https:\/\/developapp\.habitatzbraslav\.cz\/api\/calendars\/[A-Za-z0-9_-]{43}\/habitat\.ics$/);
    expect(first.jidelnicek).toBe(first.habitat.replace("habitat.ics", "jidelnicek.ics"));
    expect(JSON.stringify(first)).not.toContain("test-signing-key");
    expect(mocks.upsert).toHaveBeenCalledWith({ userId: "current-parent", rotate: false, nonce: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/), tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/) });
    await rotateCalendarSubscriptionLinks();
    expect(mocks.upsert).toHaveBeenLastCalledWith(expect.objectContaining({ userId: "current-parent", rotate: true }));
    await revokeCalendarSubscriptionLinks();
    expect(mocks.revoke).toHaveBeenCalledWith("current-parent");
  });

  it("rejects signed-out creation, rotation and revocation before database access", async () => {
    mocks.user.mockResolvedValue(null);
    for (const action of [getCalendarSubscriptionLinks, rotateCalendarSubscriptionLinks, revokeCalendarSubscriptionLinks]) {
      await expect(action()).rejects.toThrow();
    }
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.revoke).not.toHaveBeenCalled();
  });
});
