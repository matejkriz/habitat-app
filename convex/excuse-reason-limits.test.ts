import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const secret = "reason-limit-test-secret";
const date = new Date("2026-09-09T10:00:00Z").getTime();
const value = {
  id: "excuse", childId: "child", fromDate: date, toDate: date,
  reason: "Nemoc", cancelLunch: true, submittedById: "parent", submittedAt: date,
  lateApprovedAt: null, lateApprovedById: null,
  createdAt: date, updatedAt: date,
};

async function setup() {
  const t = convexTest(schema, modules);
  await t.run(async ({ db }) => {
    await db.insert("children", {
      id: "child", firstName: "Test", lastName: "Child", active: true,
      attendanceStartDate: "2026-09-01", createdAt: date, updatedAt: date,
    });
    await db.insert("users", { id: "parent", role: "PARENT", createdAt: date, updatedAt: date });
    await db.insert("parentChildren", { id: "link", parentId: "parent", childId: "child", createdAt: date });
  });
  return t;
}

describe("database excuse reason validation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(date);
    vi.stubEnv("PUSH_INTERNAL_SECRET", secret);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it.each(["EXCUSE", "MAKEUP"] as const)("rejects oversized parent %s batches atomically", async (kind) => {
    const t = await setup();
    await expect(t.mutation(api.parentExcuses.createParentExcuses, {
      secret, parentId: "parent", requestId: "request-1234567890", childIds: ["child"],
      fromDate: date, toDate: date, reason: "x".repeat(501), cancelLunch: true, kind,
    })).rejects.toThrow("nejvýše 500 znaků");
    await t.run(async ({ db }) => {
      expect(await db.query("excuses").collect()).toEqual([]);
      expect(await db.query("auditLogs").collect()).toEqual([]);
      expect(await db.query("parentExcuseRequests").collect()).toEqual([]);
    });
  });

  it("accepts a 500-character parent reason and a replay of the same request", async () => {
    const t = await setup();
    const input = {
      secret, parentId: "parent", requestId: "request-1234567890", childIds: ["child"],
      fromDate: date, toDate: date, reason: "ž".repeat(500), cancelLunch: true,
    };
    const first = await t.mutation(api.parentExcuses.createParentExcuses, input);
    expect(first.excuses[0].reason).toBe(input.reason);
    expect((await t.mutation(api.parentExcuses.createParentExcuses, input)).replayed).toBe(true);
    expect(await t.run(({ db }) => db.query("excuses").collect())).toHaveLength(1);
  });

  it("enforces the same limit in direct create and generic insert mutations", async () => {
    const t = await setup();
    const oversized = { ...value, reason: "x".repeat(501) };
    await expect(t.mutation(api.db.createExcuse, { secret, value: oversized }))
      .rejects.toThrow("nejvýše 500 znaků");
    await expect(t.mutation(api.db.insert, { secret, table: "excuses", value: oversized }))
      .rejects.toThrow("nejvýše 500 znaků");
    expect(await t.run(({ db }) => db.query("excuses").collect())).toEqual([]);
    await t.mutation(api.db.createExcuse, { secret, value: { ...value, reason: "x".repeat(500) } });
    expect(await t.query(api.db.getById, { secret, table: "excuses", id: value.id }))
      .toMatchObject({ reason: "x".repeat(500) });
  });

  it("rejects oversized edits without changing the record or creating notifications", async () => {
    const t = await setup();
    await t.run(({ db }) => db.insert("excuses", value));
    await expect(t.mutation(api.db.patchById, {
      secret, table: "excuses", id: value.id, patch: { reason: "x".repeat(501) },
    })).rejects.toThrow("nejvýše 500 znaků");
    const saved = await t.query(api.db.getById, { secret, table: "excuses", id: value.id });
    expect(saved).toMatchObject({ reason: value.reason, updatedAt: value.updatedAt });
    expect(await t.run(({ db }) => db.query("notificationEvents").collect())).toEqual([]);
    await t.mutation(api.db.patchById, {
      secret, table: "excuses", id: value.id, patch: { reason: "x".repeat(500) },
    });
    expect(await t.query(api.db.getById, { secret, table: "excuses", id: value.id }))
      .toMatchObject({ reason: "x".repeat(500) });
  });

  it("allows unrelated updates of legacy long reasons and lets the reason be shortened", async () => {
    const t = await setup();
    await t.run(({ db }) => db.insert("excuses", { ...value, reason: "x".repeat(501) }));
    await t.mutation(api.db.patchById, {
      secret, table: "excuses", id: value.id, patch: { lateApprovedAt: date },
    });
    await t.mutation(api.db.patchById, {
      secret, table: "excuses", id: value.id, patch: { reason: null },
    });
    expect(await t.query(api.db.getById, { secret, table: "excuses", id: value.id }))
      .toMatchObject({ reason: null });
  });
});
