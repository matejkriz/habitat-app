import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const inspect = makeFunctionReference<"query", Record<string, never>>("attendanceMigration:inspectFullAttendance");
const initialize = makeFunctionReference<"mutation", { expectedChildCount: number }>("attendanceMigration:initializeFullAttendance");
const originalTimestamp = 123456789;

async function setup() {
  const t = convexTest(schema, modules);
  await t.run(async ({ db }) => {
    for (const child of [
      { id: "missing", active: true },
      { id: "partial", active: true, attendanceDays: [1, 3] },
      { id: "empty", active: true, attendanceDays: [] },
      { id: "inactive", active: false, attendanceDays: [4] },
      { id: "full", active: true, attendanceDays: [1, 2, 3, 4] },
    ]) {
      await db.insert("children", {
        ...child, firstName: child.id, lastName: "Test", doesNotTakeLunch: true,
        fundSent: 450, createdAt: originalTimestamp, updatedAt: originalTimestamp,
      });
    }
    await db.insert("excuses", {
      id: "existing", childId: "partial", fromDate: originalTimestamp,
      toDate: originalTimestamp, reason: "Existing excuse", submittedById: "parent",
      submittedAt: originalTimestamp, createdAt: originalTimestamp, updatedAt: originalTimestamp,
    });
  });
  return t;
}

describe("one-time full attendance initialization", () => {
  it("reports exact schedule counts without writing any record", async () => {
    const t = await setup();
    const before = await t.run(async ({ db }) => ({ children: await db.query("children").collect(), audits: await db.query("auditLogs").collect() }));
    expect(await t.query(inspect, {})).toMatchObject({
      completed: false, totalChildren: 5, activeChildren: 4, inactiveChildren: 1,
      missingSchedule: 1, partialSchedule: 3, fullSchedule: 1, needsInitialization: 4,
      schedules: expect.arrayContaining([
        { attendanceDays: null, count: 1 },
        { attendanceDays: [], count: 1 },
        { attendanceDays: [1, 3], count: 1 },
        { attendanceDays: [4], count: 1 },
        { attendanceDays: [1, 2, 3, 4], count: 1 },
      ]),
    });
    expect(await t.run(async ({ db }) => ({ children: await db.query("children").collect(), audits: await db.query("auditLogs").collect() }))).toEqual(before);
  });

  it("initializes missing, partial, empty and inactive schedules while preserving other data", async () => {
    const t = await setup();
    const before = await t.run(({ db }) => db.query("children").collect());
    const excuses = await t.run(({ db }) => db.query("excuses").collect());
    expect(await t.mutation(initialize, { expectedChildCount: 5 })).toMatchObject({
      status: "completed", changedChildren: 4, totalChildren: 5, fullSchedule: 5, needsInitialization: 0,
    });
    const after = await t.run(({ db }) => db.query("children").collect());
    for (const child of after) {
      const original = before.find(record => record.id === child.id)!;
      expect(child).toEqual({ ...original, attendanceDays: [1, 2, 3, 4], updatedAt: child.updatedAt });
      if (child.id === "full") expect(child.updatedAt).toBe(original.updatedAt);
      else expect(child.updatedAt).toBeGreaterThan(original.updatedAt);
    }
    expect(await t.run(({ db }) => db.query("excuses").collect())).toEqual(excuses);
    const audits = await t.run(({ db }) => db.query("auditLogs").collect());
    expect(audits).toHaveLength(5);
    expect(audits.every(audit => audit.userId === null)).toBe(true);
    expect(audits.filter(audit => audit.entityType === "Child")).toHaveLength(4);
    expect(audits).toContainEqual(expect.objectContaining({ entityType: "AttendanceMigration", action: "CREATE" }));
    expect(await t.query(inspect, {})).toMatchObject({ completed: true, fullSchedule: 5, needsInitialization: 0 });
  });

  it("never overwrites director changes when rerun after completion", async () => {
    const t = await setup();
    await t.mutation(initialize, { expectedChildCount: 5 });
    await t.run(async ({ db }) => {
      const child = await db.query("children").withIndex("by_app_id", q => q.eq("id", "partial")).unique();
      await db.patch(child!._id, { attendanceDays: [2, 4], updatedAt: originalTimestamp + 1 });
    });
    const before = await t.run(async ({ db }) => ({ children: await db.query("children").collect(), audits: await db.query("auditLogs").collect() }));
    expect(await t.mutation(initialize, { expectedChildCount: 5 })).toMatchObject({
      status: "already-completed", changedChildren: 0, totalChildren: 5, fullSchedule: 4, needsInitialization: 1,
    });
    expect(await t.run(async ({ db }) => ({ children: await db.query("children").collect(), audits: await db.query("auditLogs").collect() }))).toEqual(before);
  });

  it("rejects a stale expected count before any writes", async () => {
    const t = await setup();
    const before = await t.run(({ db }) => db.query("children").collect());
    await expect(t.mutation(initialize, { expectedChildCount: 4 })).rejects.toThrow("Expected 4 children, found 5");
    expect(await t.run(({ db }) => db.query("children").collect())).toEqual(before);
    expect(await t.run(({ db }) => db.query("auditLogs").collect())).toHaveLength(0);
    expect(await t.query(inspect, {})).toMatchObject({ completed: false });
  });
});
