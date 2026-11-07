// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { internal } from "./_generated/api";

const client = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("./canteenClient", () => ({
  fetchCanteenDays: client.fetch,
  CanteenError: class extends Error {
    constructor(public readonly code: "AUTH" | "NETWORK" | "PROTOCOL" | "CONFIG") {
      super("Upstream failure for dummy-user; password=dummy-password; cookie=dummy-cookie");
    }
  },
}));
import { CanteenError } from "./canteenClient";

const modules = import.meta.glob("./**/*.ts");
const now = Date.parse("2026-11-06T08:00:00Z");
const date = Date.parse("2026-11-09T00:00:00Z");
const secrets = ["dummy-user", "dummy-password", "dummy-cookie"];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.resetAllMocks();
  vi.stubEnv("EJIDELNICEK_SYNC_ENABLED", "true");
  vi.stubEnv("EJIDELNICEK_USERNAME", secrets[0]);
  vi.stubEnv("EJIDELNICEK_PASSWORD", secrets[1]);
  client.fetch.mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

function expectNoSecrets(value: unknown) {
  const encoded = JSON.stringify(value);
  for (const secret of secrets) expect(encoded).not.toContain(secret);
}

describe("meal sync job", () => {
  it("records a successful completion even after a newer attempt failed", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.mealSyncStatus.recordResult, { startedAt: now, success: false, errorCode: "NETWORK" });
    await t.mutation(internal.mealSyncStatus.recordResult, { startedAt: now - 1000, success: true, daysRead: 1, updated: 1 });
    const [state] = await t.run(({ db }) => db.query("mealSyncState").collect());
    expect(state).toMatchObject({ lastAttemptAt: now, lastErrorCode: "NETWORK", lastSuccessAt: now, consecutiveFailures: 0, daysRead: 1, updated: 1 });
  });

  it("does not contact the canteen or write state unless explicitly enabled", async () => {
    vi.stubEnv("EJIDELNICEK_SYNC_ENABLED", "false");
    const t = convexTest(schema, modules);
    expect(await t.action(internal.mealSyncJobs.run, {})).toMatchObject({ status: "disabled" });
    expect(client.fetch).not.toHaveBeenCalled();
    expect(await t.run(({ db }) => db.query("mealSyncState").collect())).toEqual([]);
    expect(await t.run(({ db }) => db.system.query("_scheduled_functions").collect())).toEqual([]);
  });

  it("reports missing credentials without a network request or a credential value", async () => {
    vi.stubEnv("EJIDELNICEK_PASSWORD", "");
    const t = convexTest(schema, modules);
    const result = await t.action(internal.mealSyncJobs.run, {});
    expect(result).toMatchObject({ status: "not_configured" });
    expect(client.fetch).not.toHaveBeenCalled();
    const state = await t.run(({ db }) => db.query("mealSyncState").collect());
    expect(state).toHaveLength(1);
    expect(state[0]).toMatchObject({ lastErrorCode: "CONFIG", lastAttemptAt: now });
    expectNoSecrets({ result, state });
  });

  it.each([
    ["2026-03-28T23:30:00Z", "2026-03-29", "2026-04-25"],
    ["2026-10-24T22:30:00Z", "2026-10-25", "2026-11-21"],
  ])("uses a Prague calendar range across DST at %s", async (instant, dateFrom, dateTo) => {
    vi.setSystemTime(new Date(instant));
    const t = convexTest(schema, modules);
    await t.action(internal.mealSyncJobs.run, {});
    expect(client.fetch).toHaveBeenCalledOnce();
    expect(client.fetch.mock.calls[0][0]).toEqual({
      username: secrets[0], password: secrets[1], dateFrom, dateTo,
    });
  });

  it("applies a snapshot through the real mutation and keeps unrelated day fields", async () => {
    const t = convexTest(schema, modules);
    await t.run(async ({ db }) => {
      await db.insert("dayDetails", { date, name: "Les", meal: "Původní jídlo", mealCount: 4, expense: 80, recordedById: "director", updatedAt: now - 1000 });
      await db.insert("dayReports", { date, report: "Učitelský report", recordedById: "teacher", updatedAt: now - 1000 });
    });
    client.fetch.mockResolvedValue([{ date: "2026-11-09", meal: "Hrášková polévka\nRizoto", mealCount: 17 }]);

    const result = await t.action(internal.mealSyncJobs.run, {});

    expect(result).toMatchObject({ status: "synced", updated: 1 });
    const days = await t.run(({ db }) => db.query("dayDetails").collect());
    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({ date, name: "Les", meal: "Hrášková polévka\nRizoto", mealCount: 17, expense: 80 });
    expect(await t.run(({ db }) => db.query("dayReports").first())).toMatchObject({ report: "Učitelský report" });
    const state = await t.run(({ db }) => db.query("mealSyncState").collect());
    expect(state).toHaveLength(1);
    expect(state[0]).toMatchObject({ lastSuccessAt: now, lastAttemptAt: now });
    expect(state[0].lastErrorCode).toBeUndefined();
    expectNoSecrets({ result, state, days, audit: await t.run(({ db }) => db.query("auditLogs").collect()) });
  });

  it("clears only a confirmed zero-order day and preserves dates absent from the snapshot", async () => {
    const t = convexTest(schema, modules);
    await t.run(async ({ db }) => {
      for (const key of ["2026-11-09", "2026-11-10"]) {
        await db.insert("dayDetails", { date: Date.parse(`${key}T00:00:00Z`), meal: "Rizoto", mealCount: 17, recordedById: "director", updatedAt: now - 1000 });
      }
    });
    client.fetch.mockResolvedValue([{ date: "2026-11-09", meal: null, mealCount: 0 }]);
    await t.action(internal.mealSyncJobs.run, {});
    const days = await t.run(({ db }) => db.query("dayDetails").withIndex("by_date").collect());
    expect(days[0]).toMatchObject({ meal: null, mealCount: 0 });
    expect(days[1]).toMatchObject({ meal: "Rizoto", mealCount: 17 });
  });

  it.each([[0, 60_000], [1, 300_000], [2, null]] as const)("retries network failure at attempt %s with bounded secret-free arguments", async (attempt, delay) => {
    const t = convexTest(schema, modules);
    client.fetch.mockRejectedValue(new CanteenError("NETWORK"));
    const result = await t.action(internal.mealSyncJobs.run, { attempt });
    expect(result).toMatchObject({ status: "failed", errorCode: "NETWORK" });
    const scheduled = await t.run(({ db }) => db.system.query("_scheduled_functions").collect());
    if (delay === null) {
      expect(scheduled).toEqual([]);
    } else {
      expect(scheduled).toHaveLength(1);
      expect(scheduled[0]).toMatchObject({ scheduledTime: now + delay, args: [{ attempt: attempt + 1 }] });
    }
    const state = await t.run(({ db }) => db.query("mealSyncState").collect());
    expect(state[0]).toMatchObject({ lastErrorCode: "NETWORK" });
    expectNoSecrets({ result, state, scheduled });
  });

  it.each(["AUTH", "PROTOCOL"] as const)("preserves previous meals after %s and does not retry immediately", async code => {
    const t = convexTest(schema, modules);
    const original = { date, meal: "Rizoto", mealCount: 17, recordedById: "director", updatedAt: now - 1000 };
    await t.run(({ db }) => db.insert("dayDetails", original));
    client.fetch.mockRejectedValue(new CanteenError(code));
    const result = await t.action(internal.mealSyncJobs.run, {});
    expect(result).toMatchObject({ status: "failed", errorCode: code });
    expect(await t.run(({ db }) => db.query("dayDetails").first())).toMatchObject(original);
    const scheduled = await t.run(({ db }) => db.system.query("_scheduled_functions").collect());
    expect(scheduled).toEqual([]);
    const state = await t.run(({ db }) => db.query("mealSyncState").collect());
    expectNoSecrets({ result, state, scheduled });
  });

  it("replaces unexpected exception text with a fixed internal error code", async () => {
    const t = convexTest(schema, modules);
    client.fetch.mockRejectedValue(new Error(`Connection error ${secrets.join(" ")}`));
    const result = await t.action(internal.mealSyncJobs.run, {});
    expect(result).toMatchObject({ status: "failed", errorCode: "INTERNAL" });
    const state = await t.run(({ db }) => db.query("mealSyncState").collect());
    expect(state[0]).toMatchObject({ lastErrorCode: "INTERNAL" });
    expectNoSecrets({ result, state });
  });
});
