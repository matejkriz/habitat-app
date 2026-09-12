import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import schema from "./schema";
const modules = import.meta.glob("./**/*.ts");
const secret = "test-secret";
const date = new Date(2026, 8, 10).getTime();

describe("parent trip fund scope", () => {
  beforeEach(() => vi.stubEnv("PUSH_INTERNAL_SECRET", secret));
  afterEach(() => vi.unstubAllEnvs());

  it("returns only linked children and their trip days without defaults or other families' data", async () => {
    const t = convexTest(schema, modules);
    await t.run(async ({ db }) => {
      for (const id of ["anna", "eva", "stranger"]) {
        await db.insert("children", { id, firstName: id, lastName: "Test", active: true, fundSent: id === "stranger" ? 99999 : 500, createdAt: date, updatedAt: date });
        await db.insert("parentChildren", { id, parentId: id === "stranger" ? "other-parent" : "parent", childId: id, createdAt: date });
      }
      await db.insert("attendance", { id: "anna", childId: "anna", date, presence: "PRESENT", createdAt: date, updatedAt: date });
      await db.insert("attendance", { id: "eva", childId: "eva", date, presence: "ABSENT", createdAt: date, updatedAt: date });
      await db.insert("attendance", { id: "stranger", childId: "stranger", date: date + 86400000, presence: "PRESENT", createdAt: date, updatedAt: date });
    });
    await t.mutation(api.db.saveDayDetails, { secret, date, expense: 120, name: "Jarmark", report: "Private report", recordedById: "director" });
    await t.mutation(api.db.saveDayDetails, { secret, date: date + 86400000, expense: 333, name: "Other trip", recordedById: "director" });
    await t.mutation(api.db.setChildTripExpense, { secret, date, childId: "anna", amount: 80, recordedById: "director" });
    const data = await t.query(api.db.getParentTripFundOverview, { secret, parentId: "parent" });
    expect(data.days).toEqual([{ date, name: "Jarmark", expense: null }]);
    expect(data.children.map(child => child.childId)).toEqual(["anna", "eva"]);
    expect(data.children[0]).toMatchObject({ amounts: [80], fundSent: 500, fundBalance: 420 });
    expect(data.children[1]).toMatchObject({ amounts: [null], fundBalance: 500 });
    for (const hidden of ["stranger", "99999", "Other trip", "Private report"]) expect(JSON.stringify(data)).not.toContain(hidden);
    expect(await t.query(api.db.getParentTripFundOverview, { secret, parentId: "unassigned" })).toEqual({ days: [], children: [] });
    await expect(t.query(api.db.getParentTripFundOverview, { secret: "wrong", parentId: "parent" })).rejects.toThrow();
    await t.run(async ({ db }) => {
      const link = await db.query("parentChildren").filter(q => q.eq(q.field("id"), "anna")).unique();
      await db.delete(link!._id);
    });
    const afterUnlink = await t.query(api.db.getParentTripFundOverview, { secret, parentId: "parent" });
    expect(afterUnlink.children.map(child => child.childId)).toEqual(["eva"]);
    expect(afterUnlink.days).toEqual([]);
  });
});
