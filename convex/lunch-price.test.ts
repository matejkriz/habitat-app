import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const secret = "test-server-secret";
const month = "2026-10";

beforeEach(() => vi.stubEnv("PUSH_INTERNAL_SECRET", secret));
afterEach(() => vi.unstubAllEnvs());

async function setup(role: "DIRECTOR" | "PARENT" | "TEACHER" = "DIRECTOR") {
  const t = convexTest(schema, modules);
  await t.run(async ({ db }) => {
    await db.insert("users", { id: "actor", role, createdAt: 1, updatedAt: 1 });
  });
  return t;
}

describe("monthly lunch price", () => {
  it("defaults to 55 crowns and updates one price per month with an audit trail", async () => {
    const t = await setup();
    expect(await t.query(api.db.getLunchPrice, { secret, month })).toBe(5500);
    await t.mutation(api.db.setLunchPrice, { secret, month, priceCents: 6550, recordedById: "actor" });
    expect(await t.query(api.db.getLunchPrice, { secret, month })).toBe(6550);
    await t.mutation(api.db.setLunchPrice, { secret, month, priceCents: 7000, recordedById: "actor" });
    expect(await t.query(api.db.getLunchPrice, { secret, month })).toBe(7000);
    await t.run(async ({ db }) => {
      expect(await db.query("lunchSettings").collect()).toHaveLength(1);
      const logs = await db.query("auditLogs").collect();
      expect(logs).toHaveLength(2);
      expect(logs[1]).toMatchObject({ userId: "actor", entityType: "LunchSettings", previousValue: { priceCents: 6550 }, newValue: { priceCents: 7000 } });
    });
  });

  it("inherits the last earlier price across gaps and year boundaries without changing saved months", async () => {
    const t = await setup();
    await t.mutation(api.db.setLunchPrice, { secret, month: "2026-11", priceCents: 6550, recordedById: "actor" });
    expect(await t.query(api.db.getLunchPrice, { secret, month: "2026-10" })).toBe(5500);
    expect(await t.query(api.db.getLunchPrice, { secret, month: "2026-12" })).toBe(6550);
    expect(await t.query(api.db.getLunchPrice, { secret, month: "2027-01" })).toBe(6550);
    await t.mutation(api.db.setLunchPrice, { secret, month: "2026-12", priceCents: 6550, recordedById: "actor" });
    await t.mutation(api.db.setLunchPrice, { secret, month: "2026-11", priceCents: 7000, recordedById: "actor" });
    expect(await t.query(api.db.getLunchPrice, { secret, month: "2026-12" })).toBe(6550);
    expect(await t.query(api.db.getLunchPrice, { secret, month: "2027-01" })).toBe(6550);
    await t.run(async ({ db }) => {
      expect(await db.query("lunchSettings").collect()).toHaveLength(2);
    });
  });

  it.each(["2026-00", "2026-13", "2026-1", "1999-12", "2101-01"])("rejects invalid months (%s)", async month => {
    const t = await setup();
    await expect(t.query(api.db.getLunchPrice, { secret, month })).rejects.toThrow("Neplatný měsíc");
    await expect(t.mutation(api.db.setLunchPrice, { secret, month, priceCents: 5500, recordedById: "actor" })).rejects.toThrow("Neplatný měsíc");
  });

  it("persists a zero price", async () => {
    const t = await setup();
    await t.mutation(api.db.setLunchPrice, { secret, month, priceCents: 0, recordedById: "actor" });
    expect(await t.query(api.db.getLunchPrice, { secret, month })).toBe(0);
    expect(await t.query(api.db.getLunchPrice, { secret, month: "2026-11" })).toBe(0);
  });

  it.each(["PARENT", "TEACHER"] as const)("rejects a %s write even with the server secret", async role => {
    const t = await setup(role);
    await expect(t.mutation(api.db.setLunchPrice, { secret, month, priceCents: 6500, recordedById: "actor" })).rejects.toThrow("Unauthorized");
  });

  it("rejects invalid cents, unknown actors, and unauthorized access", async () => {
    const t = await setup();
    await expect(t.query(api.db.getLunchPrice, { secret: "wrong", month })).rejects.toThrow();
    await expect(t.mutation(api.db.setLunchPrice, { secret: "wrong", month, priceCents: 6500, recordedById: "actor" })).rejects.toThrow();
    await expect(t.mutation(api.db.setLunchPrice, { secret, month, priceCents: 6500, recordedById: "missing" })).rejects.toThrow("Unauthorized");
    for (const priceCents of [-1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      await expect(t.mutation(api.db.setLunchPrice, { secret, month, priceCents, recordedById: "actor" })).rejects.toThrow();
    }
    expect(await t.query(api.db.getLunchPrice, { secret, month })).toBe(5500);
  });
});
