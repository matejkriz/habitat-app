import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const secret = "test-server-secret";
const beforeStart = Date.parse("2026-08-31T00:00:00+02:00");
const start = Date.parse("2026-09-01T00:00:00+02:00");
const now = Date.parse("2026-09-02T08:00:00Z");

async function setup() {
  const t = convexTest(schema, modules);
  await t.run(async ({ db }) => {
    await db.insert("children", { id: "child", firstName: "Anna", lastName: "Malá", active: true, createdAt: now, updatedAt: now });
    await db.insert("users", { id: "parent", role: "PARENT", workosId: "workos-parent", createdAt: now, updatedAt: now });
    await db.insert("parentChildren", { id: "link", parentId: "parent", childId: "child", createdAt: now });
  });
  return t;
}

const attendance = (date: number) => ({ id: "attendance", childId: "child", date, presence: "PRESENT" as const, createdAt: now, updatedAt: now });
const excuse = (fromDate: number, toDate = fromDate) => ({
  id: "excuse", childId: "child", fromDate, toDate, reason: null, cancelLunch: true,
  submittedById: "parent", submittedAt: now, lateApprovedAt: null, lateApprovedById: null, createdAt: now, updatedAt: now,
});

beforeEach(() => vi.stubEnv("PUSH_INTERNAL_SECRET", secret));
afterEach(() => vi.unstubAllEnvs());

describe("attendance start boundary", () => {
  it.each(["2026-02-30", "2026-9-01", "", null])("rejects an invalid stored start date %s", async attendanceStartDate => {
    const t = await setup();
    await expect(t.mutation(api.db.patchById, { secret, table: "children", id: "child", patch: { attendanceStartDate } })).rejects.toThrow("datum");
    await expect(t.mutation(api.db.insert, { secret, table: "children", value: { id: "new-child", firstName: "Nové", lastName: "Dítě", active: true, attendanceStartDate, createdAt: now, updatedAt: now } })).rejects.toThrow("datum");
  });

  it("honors a child's explicit start date and allows its first day", async () => {
    const t = await setup();
    await t.mutation(api.db.patchById, { secret, table: "children", id: "child", patch: { attendanceStartDate: "2026-09-02" } });
    await expect(t.mutation(api.db.saveAttendanceDay, { secret, date: start, recordedById: "teacher", auditId: "audit", records: [{ id: "attendance", childId: "child", presence: "PRESENT" }] })).rejects.toThrow("nástup");
    const result = await t.mutation(api.db.saveAttendanceDay, { secret, date: Date.parse("2026-09-02T00:00:00+02:00"), recordedById: "teacher", auditId: "audit", records: [{ id: "attendance", childId: "child", presence: "PRESENT" }] });
    expect(result).toHaveLength(1);
  });

  it("rejects a whole attendance batch before the legacy start without saving audit or attendance", async () => {
    const t = await setup();
    await expect(t.mutation(api.db.saveAttendanceDay, { secret, date: beforeStart, recordedById: "teacher", auditId: "audit", records: [{ id: "attendance", childId: "child", presence: "PRESENT" }] })).rejects.toThrow("nástup");
    expect(await t.run(({ db }) => db.query("attendance").collect())).toEqual([]);
    expect(await t.run(({ db }) => db.query("auditLogs").collect())).toEqual([]);
  });

  it("allows the first day using Prague's date even though the UTC date is still August", async () => {
    const t = await setup();
    const result = await t.mutation(api.db.saveAttendanceDay, { secret, date: start, recordedById: "teacher", auditId: "audit", records: [{ id: "attendance", childId: "child", presence: "PRESENT" }] });
    expect(result).toHaveLength(1);
  });

  it("rejects generic attendance inserts before the start", async () => {
    const t = await setup();
    await expect(t.mutation(api.db.insert, { secret, table: "attendance", value: attendance(beforeStart) })).rejects.toThrow("nástup");
  });

  it("rejects moving attendance before the start through a generic patch", async () => {
    const t = await setup();
    await t.run(({ db }) => db.insert("attendance", attendance(start)));
    await expect(t.mutation(api.db.patchById, { secret, table: "attendance", id: "attendance", patch: { date: beforeStart } })).rejects.toThrow("nástup");
    expect(await t.run(({ db }) => db.query("attendance").first())).toMatchObject({ date: start });
  });

  it.each(["EXCUSE", "MAKEUP"] as const)("rejects %s ranges crossing the start", async kind => {
    const t = await setup();
    await expect(t.mutation(api.db.createExcuse, { secret, value: { ...excuse(beforeStart, start), kind } })).rejects.toThrow("nástup");
  });

  it("rejects an excuse whose end is before the start even if its beginning is after it", async () => {
    const t = await setup();
    await expect(t.mutation(api.db.createExcuse, { secret, value: excuse(start, beforeStart) })).rejects.toThrow("nástup");
  });

  it("rejects generic excuse inserts and edits before the start", async () => {
    const t = await setup();
    await expect(t.mutation(api.db.insert, { secret, table: "excuses", value: excuse(beforeStart) })).rejects.toThrow("nástup");
    await t.run(({ db }) => db.insert("excuses", excuse(start)));
    await expect(t.mutation(api.db.patchById, { secret, table: "excuses", id: "excuse", patch: { fromDate: beforeStart } })).rejects.toThrow("nástup");
  });

  it("preserves metadata edits on historical excuses after a corrected start date", async () => {
    const t = await setup();
    await t.run(({ db }) => db.insert("excuses", excuse(start)));
    await t.mutation(api.db.patchById, { secret, table: "children", id: "child", patch: { attendanceStartDate: "2026-09-02" } });
    await t.mutation(api.db.patchById, { secret, table: "excuses", id: "excuse", patch: { reason: "Opravená poznámka", lateApprovedAt: now } });
    expect(await t.run(({ db }) => db.query("excuses").first())).toMatchObject({ reason: "Opravená poznámka", lateApprovedAt: now, fromDate: start });
    await expect(t.mutation(api.db.patchById, { secret, table: "excuses", id: "excuse", patch: { toDate: start + 86400000 } })).rejects.toThrow("nástup");
  });

  it("rejects parent excuse requests before the child's start atomically", async () => {
    const t = await setup();
    await expect(t.mutation(api.parentExcuses.createParentExcuses, { secret, parentId: "parent", requestId: "request-before-start", childIds: ["child"], fromDate: beforeStart, toDate: start, reason: null, cancelLunch: true })).rejects.toThrow("nástup");
    expect(await t.run(({ db }) => db.query("parentExcuseRequests").collect())).toEqual([]);
  });

  it("rejects MCP excuse requests before the child's start atomically", async () => {
    const t = await setup();
    await expect(t.mutation(api.mcp.createParentExcuses, { secret, workosUserId: "workos-parent", requestId: "123e4567-e89b-42d3-a456-426614174000", childIds: ["child"], fromDate: beforeStart, toDate: start, reason: null })).rejects.toThrow("nástup");
    expect(await t.run(({ db }) => db.query("mcpExcuseRequests").collect())).toEqual([]);
  });

  it("rejects new individual trip charges for stale pre-start attendance", async () => {
    const t = await setup();
    await t.run(({ db }) => db.insert("attendance", attendance(beforeStart)));
    await expect(t.mutation(api.db.createTripExpense, { secret, date: beforeStart, expense: 100, overrides: [{ childId: "child", amount: 75 }], recordedById: "teacher" })).rejects.toThrow("nástup");
    expect(await t.run(({ db }) => db.query("dayDetails").collect())).toEqual([]);
  });

  it("excludes stale pre-start attendance and expense overrides from trip balances and day details", async () => {
    const t = await setup();
    await t.run(async ({ db }) => {
      await db.insert("attendance", attendance(beforeStart));
      await db.insert("dayDetails", { date: beforeStart, expense: 100, recordedById: "teacher", updatedAt: now });
      await db.insert("childTripExpenses", { childId: "child", date: beforeStart, amount: 75, recordedById: "teacher", updatedAt: now });
    });
    expect((await t.query(api.db.getTripFunds, { secret }))[0].fundSpent).toBe(0);
    expect(await t.query(api.db.getDayTripExpenses, { secret, date: beforeStart })).toEqual([]);
    await expect(t.mutation(api.db.setChildTripExpense, { secret, date: beforeStart, childId: "child", amount: 50, recordedById: "teacher" })).rejects.toThrow("nástup");
  });
});
