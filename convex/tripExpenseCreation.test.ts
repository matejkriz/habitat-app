import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import schema from "./schema";
const modules = import.meta.glob("./**/*.ts");
const secret = "test-secret";
const date = new Date(2026, 8, 15).getTime();
const args = { secret, date, expense: 120, overrides: [{ childId: "anna", amount: 80 }], recordedById: "director" };

async function setup() {
  const t = convexTest(schema, modules);
  await t.run(async ({ db }) => {
    for (const id of ["anna", "eva", "absent"]) {
      await db.insert("children", { id, firstName: id, lastName: "Test", active: true, fundSent: 500, createdAt: date, updatedAt: date });
      await db.insert("attendance", { id, childId: id, date, presence: id === "absent" ? "ABSENT" : "PRESENT", createdAt: date, updatedAt: date });
    }
  });
  return t;
}

describe("create trip expense", () => {
  beforeEach(() => vi.stubEnv("PUSH_INTERNAL_SECRET", secret));
  afterEach(() => vi.unstubAllEnvs());

  it("atomically adds a default and individual amounts while preserving day notes", async () => {
    const t = await setup();
    await t.mutation(api.db.saveDayDetails, { secret, date, name: "Zoo", report: "Poznámky", recordedById: "director" });
    await t.mutation(api.db.createTripExpense, args);
    expect(await t.query(api.db.getDayDetails, { secret, date, includeReport: true })).toEqual({ name: "Zoo", report: "Poznámky", expense: 120 });
    const ledger = await t.query(api.db.getTripFundOverview, { secret });
    expect(ledger.days).toHaveLength(1);
    expect(ledger.children.map(child => child.amounts)).toEqual([[80], [120], [null]]);
    expect(ledger.children.map(child => child.fundBalance)).toEqual([420, 380, 500]);
    await expect(t.mutation(api.db.createTripExpense, args)).rejects.toThrow("Pro tento den už je útrata");
    expect((await t.query(api.db.getTripFundOverview, { secret })).children[0].fundBalance).toBe(420);
  });

  it("rejects invalid or absent children and amounts without saving a partial trip", async () => {
    const t = await setup();
    for (const patch of [
      { overrides: [{ childId: "absent", amount: 50 }] },
      { overrides: [{ childId: "missing", amount: 50 }] },
      { overrides: [{ childId: "anna", amount: -1 }] },
      { overrides: [{ childId: "anna", amount: 20 }, { childId: "anna", amount: 30 }] },
      { expense: 1.2 }, { expense: -1 }, { date: NaN }, { secret: "wrong" },
    ]) {
      await expect(t.mutation(api.db.createTripExpense, { ...args, ...patch })).rejects.toThrow();
      expect((await t.query(api.db.getTripFundOverview, { secret })).days).toHaveLength(0);
    }
  });

  it("allows a zero default before attendance exists without charging anyone", async () => {
    const t = await setup();
    await t.mutation(api.db.createTripExpense, { ...args, date: date + 86400000, expense: 0, overrides: [] });
    const ledger = await t.query(api.db.getTripFundOverview, { secret });
    expect(ledger.days).toHaveLength(1);
    expect(ledger.children.every(child => child.fundBalance === 500 && child.amounts[0] === null)).toBe(true);
  });
});
