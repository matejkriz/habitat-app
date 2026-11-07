import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const now = Date.parse("2026-11-06T12:00:00Z");
const date = "2026-11-09";
const timestamp = Date.parse(`${date}T00:00:00Z`);
const day = { date, meal: "Zeleninová polévka\nKuře s rýží", mealCount: 17 };
const snapshot = { days: [day], startedAt: now - 1000 };

describe("canteen snapshot storage", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); });
  afterEach(() => vi.useRealTimers());

  it("preserves a manual edit committed in the same millisecond as fetch start", async () => {
    const t = convexTest(schema, modules);
    const id = await t.run(({ db }) => db.insert("dayDetails", {
      date: timestamp, meal: "Ruční úprava", mealCount: 3, recordedById: "director", updatedAt: snapshot.startedAt,
    }));
    expect(await t.mutation(internal.mealSync.applySnapshot, snapshot)).toEqual({ updated: 0, unchanged: 0, skipped: 1 });
    expect(await t.run(({ db }) => db.get(id))).toMatchObject({ meal: "Ruční úprava", mealCount: 3 });
  });

  it("creates a UTC calendar day as an internal system operation", async () => {
    const t = convexTest(schema, modules);
    expect(await t.mutation(internal.mealSync.applySnapshot, snapshot)).toEqual({ updated: 1, unchanged: 0, skipped: 0 });
    const rows = await t.run(({ db }) => db.query("dayDetails").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ date: timestamp, meal: day.meal, mealCount: 17,
      mealSyncedAt: snapshot.startedAt, recordedById: "system:meal-sync" });
    const audits = await t.run(({ db }) => db.query("auditLogs").collect());
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ userId: "system:meal-sync", entityType: "DayDetails",
      newValue: { meal: day.meal, mealCount: 17, source: "canteen" } });
  });

  it.each(["2026-11-08T23:00:00Z", "2026-09-09T22:00:00Z"])("reuses the Prague-midnight row at %s and preserves names, expenses and reports", async existingDate => {
    const t = convexTest(schema, modules);
    const existingTimestamp = Date.parse(existingDate);
    const schoolDate = existingDate.startsWith("2026-11") ? date : "2026-09-10";
    const id = await t.run(async ({ db }) => {
      await db.insert("dayReports", { date: existingTimestamp, report: "Report učitelek", recordedById: "teacher", updatedAt: now - 5000 });
      return db.insert("dayDetails", { date: existingTimestamp, name: "Výlet", expense: 120,
        meal: "Původní jídlo", mealCount: 20, recordedById: "director", updatedAt: now - 5000 });
    });
    await t.mutation(internal.mealSync.applySnapshot, { ...snapshot, days: [{ ...day, date: schoolDate }] });
    const details = await t.run(({ db }) => db.get(id));
    expect(details).toMatchObject({ date: existingTimestamp, name: "Výlet", expense: 120, meal: day.meal, mealCount: 17 });
    expect(await t.run(({ db }) => db.query("dayDetails").collect())).toHaveLength(1);
    expect(await t.run(({ db }) => db.query("dayReports").collect())).toEqual([
      expect.objectContaining({ date: existingTimestamp, report: "Report učitelek", recordedById: "teacher" }),
    ]);
  });

  it("does not create duplicate audits or change manual attribution for unchanged content", async () => {
    const t = convexTest(schema, modules);
    const id = await t.run(({ db }) => db.insert("dayDetails", { date: timestamp, meal: day.meal,
      mealCount: 17, recordedById: "director", updatedAt: now - 5000 }));
    expect(await t.mutation(internal.mealSync.applySnapshot, snapshot)).toEqual({ updated: 0, unchanged: 1, skipped: 0 });
    expect(await t.mutation(internal.mealSync.applySnapshot, snapshot)).toEqual({ updated: 0, unchanged: 0, skipped: 1 });
    vi.setSystemTime(now + 5000);
    expect(await t.mutation(internal.mealSync.applySnapshot, { ...snapshot, startedAt: now + 4000 })).toEqual({ updated: 0, unchanged: 1, skipped: 0 });
    expect(await t.run(({ db }) => db.get(id))).toMatchObject({ mealSyncedAt: now + 4000,
      recordedById: "director", updatedAt: now - 5000 });
    expect(await t.run(({ db }) => db.query("auditLogs").collect())).toHaveLength(0);
  });

  it("clears confirmed zero orders and leaves omitted dates untouched", async () => {
    const t = convexTest(schema, modules);
    await t.run(async ({ db }) => {
      for (const schoolDate of [timestamp, timestamp + 86400000]) {
        await db.insert("dayDetails", { date: schoolDate, meal: "Rizoto", mealCount: 17,
          recordedById: "director", updatedAt: now - 5000 });
      }
    });
    await t.mutation(internal.mealSync.applySnapshot, { ...snapshot, days: [{ date, meal: "Nabídka není objednávka", mealCount: 0 }] });
    const rows = await t.run(({ db }) => db.query("dayDetails").withIndex("by_date").collect());
    expect(rows[0]).toMatchObject({ date: timestamp, meal: null, mealCount: 0 });
    expect(rows[1]).toMatchObject({ date: timestamp + 86400000, meal: "Rizoto", mealCount: 17,
      recordedById: "director", updatedAt: now - 5000 });
    expect(await t.mutation(internal.mealSync.applySnapshot, { days: [], startedAt: now })).toEqual({ updated: 0, unchanged: 0, skipped: 0 });
    expect(await t.run(({ db }) => db.query("dayDetails").collect())).toHaveLength(2);
  });

  it("ignores an older snapshot and a manual edit made after the fetch began", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.mealSync.applySnapshot, snapshot);
    vi.setSystemTime(now + 5000);
    await t.mutation(internal.mealSync.applySnapshot, { days: [{ ...day, mealCount: 12 }], startedAt: now + 4000 });
    expect(await t.mutation(internal.mealSync.applySnapshot, { ...snapshot, startedAt: now + 2000 })).toEqual({ updated: 0, unchanged: 0, skipped: 1 });
    const rows = await t.run(({ db }) => db.query("dayDetails").collect());
    await t.run(({ db }) => db.patch(rows[0]._id, { meal: "Ruční oprava", mealCount: 10,
      recordedById: "director", updatedAt: now + 7000 }));
    vi.setSystemTime(now + 9000);
    expect(await t.mutation(internal.mealSync.applySnapshot, { ...snapshot, startedAt: now + 6000 })).toEqual({ updated: 0, unchanged: 0, skipped: 1 });
    expect(await t.run(({ db }) => db.get(rows[0]._id))).toMatchObject({ meal: "Ruční oprava", mealCount: 10, recordedById: "director" });
    expect(await t.run(({ db }) => db.query("auditLogs").collect())).toHaveLength(2);
  });

  it("validates the entire snapshot before any row is committed", async () => {
    const t = convexTest(schema, modules);
    const invalidDays = [
      { ...day, date: "2026-02-30" }, { ...day, date: "2026-1-09" },
      { ...day, mealCount: -1 }, { ...day, mealCount: 1.5 },
      { ...day, mealCount: Number.MAX_SAFE_INTEGER + 1 }, { ...day, meal: "a".repeat(2001) },
      { ...day, meal: " " },
    ];
    for (const invalid of invalidDays) {
      await expect(t.mutation(internal.mealSync.applySnapshot, { ...snapshot, days: [{ ...day, date: "2026-11-10" }, invalid] })).rejects.toThrow();
    }
    await expect(t.mutation(internal.mealSync.applySnapshot, { ...snapshot, days: [day, day] })).rejects.toThrow("Duplicate");
    await expect(t.mutation(internal.mealSync.applySnapshot, { ...snapshot, days: Array.from({ length: 32 }, () => day) })).rejects.toThrow("Invalid");
    await expect(t.mutation(internal.mealSync.applySnapshot, { ...snapshot, startedAt: -1 })).rejects.toThrow("Invalid");
    expect(await t.run(({ db }) => db.query("dayDetails").collect())).toHaveLength(0);
    expect(await t.run(({ db }) => db.query("auditLogs").collect())).toHaveLength(0);
  });

  it("prefers an exact UTC row and rejects ambiguous legacy dates", async () => {
    const t = convexTest(schema, modules);
    await t.run(async ({ db }) => {
      for (const schoolDate of [timestamp - 3600000, timestamp]) {
        await db.insert("dayDetails", { date: schoolDate, meal: "Původní", mealCount: 20,
          recordedById: "director", updatedAt: now - 5000 });
      }
    });
    await t.mutation(internal.mealSync.applySnapshot, snapshot);
    const rows = await t.run(({ db }) => db.query("dayDetails").withIndex("by_date").collect());
    expect(rows[0].meal).toBe("Původní");
    expect(rows[1].meal).toBe(day.meal);
    const ambiguous = convexTest(schema, modules);
    await ambiguous.run(async ({ db }) => {
      for (const schoolDate of [timestamp + 3600000, timestamp + 7200000]) {
        await db.insert("dayDetails", { date: schoolDate, meal: "Původní", mealCount: 20,
          recordedById: "director", updatedAt: now - 5000 });
      }
    });
    await expect(ambiguous.mutation(internal.mealSync.applySnapshot, snapshot)).rejects.toThrow("Ambiguous");
    expect(await ambiguous.run(({ db }) => db.query("auditLogs").collect())).toHaveLength(0);
  });
});
