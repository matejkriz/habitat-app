import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const inspect = makeFunctionReference<"query", Record<string, never>>("attendanceStartMigration:inspectAttendanceStartDates");
const backfill = makeFunctionReference<"mutation", { expectedChildCount: number }>("attendanceStartMigration:backfillAttendanceStartDates");

async function setup() {
  const t = convexTest(schema, modules);
  await t.run(async ({ db }) => {
    for (const child of [
      { id: "existing", active: true },
      { id: "inactive", active: false },
      { id: "newer", active: true, attendanceStartDate: "2026-10-13" },
    ]) {
      await db.insert("children", { ...child, firstName: child.id, lastName: "Test", attendanceDays: [1, 3], doesNotTakeLunch: true, fundSent: 500, createdAt: 1, updatedAt: 1 });
    }
  });
  return t;
}

describe("child attendance start backfill", () => {
  it("inspects missing dates without writing", async () => {
    const t = await setup();
    const before = await t.run(({ db }) => db.query("children").collect());
    expect(await t.query(inspect, {})).toMatchObject({ totalChildren: 3, missingStartDate: 2 });
    expect(await t.run(({ db }) => db.query("children").collect())).toEqual(before);
  });
  it("fills missing dates for active and inactive children while preserving configured dates and other data", async () => {
    const t = await setup();
    const before = await t.run(({ db }) => db.query("children").collect());
    expect(await t.mutation(backfill, { expectedChildCount: 3 })).toMatchObject({ totalChildren: 3, changedChildren: 2, missingStartDate: 0 });
    const after = await t.run(({ db }) => db.query("children").collect());
    for (const child of after) {
      const original = before.find(row => row.id === child.id)!;
      expect(child).toEqual({ ...original, attendanceStartDate: original.attendanceStartDate ?? "2026-09-01", updatedAt: child.updatedAt });
    }
    const audits = await t.run(({ db }) => db.query("auditLogs").collect());
    expect(audits).toHaveLength(2);
    expect(audits.every(row => row.entityType === "Child" && row.action === "UPDATE")).toBe(true);
    expect(await t.mutation(backfill, { expectedChildCount: 3 })).toMatchObject({ changedChildren: 0 });
    expect(await t.run(({ db }) => db.query("auditLogs").collect())).toEqual(audits);
  });
  it("rejects a stale expected count without writing", async () => {
    const t = await setup();
    await expect(t.mutation(backfill, { expectedChildCount: 2 })).rejects.toThrow("Expected 2 children, found 3");
    expect(await t.query(inspect, {})).toMatchObject({ missingStartDate: 2 });
    expect(await t.run(({ db }) => db.query("auditLogs").collect())).toEqual([]);
  });
});
