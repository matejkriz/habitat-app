import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const secret = "test-secret";
const date = new Date(2026, 8, 10).getTime();
const actor = { secret, recordedById: "director" };

describe("extra fund people", () => {
  beforeEach(() => vi.stubEnv("PUSH_INTERNAL_SECRET", secret));
  afterEach(() => vi.unstubAllEnvs());

  it("stores names and manual amounts independently of children and attendance", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.db.createExtraFundPerson, { ...actor, id: "person", name: "  Eva Nová  " });
    await t.mutation(api.db.saveDayDetails, { ...actor, date, expense: 120 });
    let overview = await t.query(api.db.getTripFundOverview, { secret });
    expect(overview.children).toEqual([]);
    expect(overview.extraPeople).toEqual([{ personId: "person", name: "Eva Nová", fundSent: 0, fundSpent: 0, fundBalance: 0, amounts: [0] }]);
    await t.mutation(api.db.updateExtraFundPerson, { ...actor, personId: "person", name: "Eva Malá", fundSent: 500 });
    await t.mutation(api.db.setExtraFundExpense, { ...actor, personId: "person", date, amount: 80 });
    await t.mutation(api.db.saveDayDetails, { ...actor, date, expense: null });
    overview = await t.query(api.db.getTripFundOverview, { secret });
    expect(overview.days.map(day => day.date)).toEqual([date]);
    expect(overview.extraPeople?.[0]).toMatchObject({ name: "Eva Malá", fundSent: 500, fundSpent: 80, fundBalance: 420, amounts: [80] });
    await t.mutation(api.db.setExtraFundExpense, { ...actor, personId: "person", date, amount: 0 });
    expect((await t.query(api.db.getTripFundOverview, { secret })).extraPeople?.[0].fundBalance).toBe(500);
    expect(await t.query(api.db.getTripFunds, { secret })).toEqual([]);
    await t.run(async ({ db }) => {
      await db.insert("children", { id: "child", firstName: "Anna", lastName: "Malá", active: true, createdAt: date, updatedAt: date });
      await db.insert("parentChildren", { id: "link", parentId: "parent", childId: "child", createdAt: date });
    });
    const parent = await t.query(api.db.getParentTripFundOverview, { secret, parentId: "parent" });
    expect(parent).not.toHaveProperty("extraPeople");
    expect(parent.days).toEqual([]);
  });

  it("rejects unauthorized requests, invalid values and unknown people", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.db.createExtraFundPerson, { ...actor, secret: "wrong", id: "p", name: "Eva" })).rejects.toThrow();
    for (const name of [" ", "a".repeat(161)]) {
      await expect(t.mutation(api.db.createExtraFundPerson, { ...actor, id: "p", name })).rejects.toThrow();
    }
    await t.mutation(api.db.createExtraFundPerson, { ...actor, id: "p", name: "Eva" });
    for (const amount of [-1, 1.5, Infinity]) {
      await expect(t.mutation(api.db.updateExtraFundPerson, { ...actor, personId: "p", fundSent: amount })).rejects.toThrow();
      await expect(t.mutation(api.db.setExtraFundExpense, { ...actor, personId: "p", date, amount })).rejects.toThrow();
    }
    await expect(t.mutation(api.db.updateExtraFundPerson, { ...actor, personId: "p", name: " " })).rejects.toThrow();
    await expect(t.mutation(api.db.updateExtraFundPerson, { ...actor, secret: "wrong", personId: "p", name: "X" })).rejects.toThrow();
    await expect(t.mutation(api.db.setExtraFundExpense, { ...actor, secret: "wrong", personId: "p", date, amount: 5 })).rejects.toThrow();
    await expect(t.mutation(api.db.updateExtraFundPerson, { ...actor, personId: "missing", name: "X" })).rejects.toThrow();
    await expect(t.mutation(api.db.setExtraFundExpense, { ...actor, personId: "missing", date, amount: 5 })).rejects.toThrow();
    await expect(t.mutation(api.db.setExtraFundExpense, { ...actor, personId: "p", date: NaN, amount: 5 })).rejects.toThrow();
  });
});
