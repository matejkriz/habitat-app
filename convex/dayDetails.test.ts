import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const secret = "test-server-secret";
const date = new Date(2026, 8, 10).getTime();
const change = { secret, date, recordedById: "director", name: "Jarmark", expense: 120, report: "Poznámky učitelek\nDruhý odstavec" };

describe("day details and trip funds", () => {
  beforeEach(() => vi.stubEnv("PUSH_INTERNAL_SECRET", secret));
  afterEach(() => vi.unstubAllEnvs());

  it("updates one day without losing its report and allows clearing optional fields", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.db.saveDayDetails, change);
    await t.mutation(api.db.saveDayDetails, { secret, date, recordedById: "director", name: null, expense: 0 });
    expect(await t.query(api.db.getDayDetails, { secret, date, includeReport: true })).toEqual({ name: null, expense: 0, report: change.report });
    expect(await t.query(api.db.listDayDetails, { secret, from: date, to: date })).toEqual([{ date, name: null, expense: 0 }]);
    await t.mutation(api.db.saveDayDetails, { secret, date, recordedById: "director", expense: null, report: null });
    expect(await t.query(api.db.getDayDetails, { secret, date, includeReport: true })).toEqual({ name: null, expense: null, report: null });
  });

  it("rejects invalid names, dates, amounts and oversized UTF-8 reports", async () => {
    const t = convexTest(schema, modules);
    for (const patch of [{ name: "a".repeat(161) }, { expense: -1 }, { expense: 1.2 }, { expense: Infinity }, { date: NaN }, { report: "ž".repeat(470_000) }]) {
      await expect(t.mutation(api.db.saveDayDetails, { ...change, ...patch })).rejects.toThrow();
    }
    await t.mutation(api.db.saveDayDetails, { ...change, name: "a".repeat(160), report: "ž".repeat(450_000) });
  });

  it("requires the server secret and excludes reports from summary reads", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.db.saveDayDetails, { ...change, secret: "wrong" })).rejects.toThrow();
    await t.mutation(api.db.saveDayDetails, change);
    expect(await t.query(api.db.getDayDetails, { secret, date, includeReport: false })).not.toHaveProperty("report");
  });

  it("derives balances from present attendance and recalculates after corrections", async () => {
    const t = convexTest(schema, modules);
    const attendanceId = await t.run(async ({ db }) => {
      for (const id of ["present", "absent", "unknown"]) {
        await db.insert("children", { id, firstName: id, lastName: "Test", active: true, fundSent: 500, createdAt: date, updatedAt: date });
      }
      await db.insert("attendance", { id: "a2", childId: "absent", date, presence: "ABSENT", createdAt: date, updatedAt: date });
      return db.insert("attendance", { id: "a1", childId: "present", date, presence: "PRESENT", createdAt: date, updatedAt: date });
    });
    await t.mutation(api.db.saveDayDetails, change);
    expect(await t.query(api.db.getTripFunds, { secret })).toEqual([
      { childId: "present", fundSent: 500, fundSpent: 120, fundBalance: 380 },
      { childId: "absent", fundSent: 500, fundSpent: 0, fundBalance: 500 },
      { childId: "unknown", fundSent: 500, fundSpent: 0, fundBalance: 500 },
    ]);
    await t.mutation(api.db.saveDayDetails, { ...change, expense: 200 });
    expect((await t.query(api.db.getTripFunds, { secret }))[0].fundBalance).toBe(300);
    await t.run(({ db }) => db.patch(attendanceId, { presence: "ABSENT" }));
    expect((await t.query(api.db.getTripFunds, { secret }))[0].fundBalance).toBe(500);
  });
  it("uses individual trip amounts, keeps overrides when the default changes, and restores the default", async () => {
    const t = convexTest(schema, modules);
    await t.run(async ({ db }) => {
      await db.insert("children", { id: "child", firstName: "Anna", lastName: "Malá", active: true, fundSent: 500, createdAt: date, updatedAt: date });
      await db.insert("attendance", { id: "a", childId: "child", date, presence: "PRESENT", createdAt: date, updatedAt: date });
    });
    await t.mutation(api.db.saveDayDetails, change);
    expect((await t.query(api.db.getDayTripExpenses, { secret, date }))[0]).toMatchObject({ childId: "child", amount: 120, override: null });
    await t.mutation(api.db.setChildTripExpense, { secret, date, childId: "child", amount: 0, recordedById: "director" });
    await t.mutation(api.db.saveDayDetails, { ...change, expense: 200 });
    expect((await t.query(api.db.getTripFunds, { secret }))[0].fundBalance).toBe(500);
    expect((await t.query(api.db.getDayTripExpenses, { secret, date }))[0]).toMatchObject({ amount: 0, override: 0 });
    await t.mutation(api.db.setChildTripExpense, { secret, date, childId: "child", amount: null, recordedById: "director" });
    expect((await t.query(api.db.getTripFunds, { secret }))[0].fundBalance).toBe(300);
    for (const amount of [-1, 1.2, Infinity]) {
      await expect(t.mutation(api.db.setChildTripExpense, { secret, date, childId: "child", amount, recordedById: "director" })).rejects.toThrow();
    }
  });

});
