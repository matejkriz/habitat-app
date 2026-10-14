import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const secret = "test-server-secret";
const month = "2026-09";

beforeEach(() => vi.stubEnv("PUSH_INTERNAL_SECRET", secret));
afterEach(() => vi.unstubAllEnvs());

async function setup(role: "DIRECTOR" | "PARENT" | "TEACHER" = "DIRECTOR") {
  const t = convexTest(schema, modules);
  await t.run(async ({ db }) => {
    await db.insert("users", { id: "actor", role, createdAt: 1, updatedAt: 1 });
    for (const id of ["anna", "jan"]) {
      await db.insert("children", { id, firstName: id, lastName: "Malá", active: true, createdAt: 1, updatedAt: 1 });
    }
  });
  return t;
}

describe("monthly lunch payments", () => {
  it("persists independent child and month statuses, supports correction, and audits changes", async () => {
    const t = await setup();
    expect(await t.query(api.db.listLunchPayments, { secret, month })).toEqual([]);
    await t.mutation(api.db.setLunchPaid, { secret, month, childId: "anna", paid: true, recordedById: "actor" });
    await t.mutation(api.db.setLunchPaid, { secret, month, childId: "jan", paid: true, recordedById: "actor" });
    expect(await t.query(api.db.listLunchPayments, { secret, month: "2026-10" })).toEqual([]);
    await t.mutation(api.db.setLunchPaid, { secret, month, childId: "anna", paid: false, recordedById: "actor" });
    expect(await t.query(api.db.listLunchPayments, { secret, month })).toEqual([
      { childId: "anna", paid: false }, { childId: "jan", paid: true },
    ]);
    await t.run(async ({ db }) => {
      expect(await db.query("lunchPayments").collect()).toHaveLength(2);
      const logs = await db.query("auditLogs").collect();
      expect(logs).toHaveLength(3);
      expect(logs[2]).toMatchObject({ userId: "actor", entityType: "LunchPayment", entityId: `${month}:anna`, previousValue: { paid: true }, newValue: { paid: false } });
    });
  });

  it.each(["PARENT", "TEACHER"] as const)("rejects %s updates even with a server secret", async role => {
    const t = await setup(role);
    await expect(t.mutation(api.db.setLunchPaid, { secret, month, childId: "anna", paid: true, recordedById: "actor" })).rejects.toThrow("Unauthorized");
  });

  it("rejects invalid months, missing children or actors, and unauthorized access", async () => {
    const t = await setup();
    await expect(t.query(api.db.listLunchPayments, { secret: "wrong", month })).rejects.toThrow();
    await expect(t.mutation(api.db.setLunchPaid, { secret: "wrong", month, childId: "anna", paid: true, recordedById: "actor" })).rejects.toThrow();
    await expect(t.mutation(api.db.setLunchPaid, { secret, month: "2026-13", childId: "anna", paid: true, recordedById: "actor" })).rejects.toThrow("Neplatný měsíc");
    await expect(t.mutation(api.db.setLunchPaid, { secret, month, childId: "missing", paid: true, recordedById: "actor" })).rejects.toThrow("Dítě nenalezeno");
    await expect(t.mutation(api.db.setLunchPaid, { secret, month, childId: "anna", paid: true, recordedById: "missing" })).rejects.toThrow("Unauthorized");
    expect(await t.query(api.db.listLunchPayments, { secret, month })).toEqual([]);
  });
});
