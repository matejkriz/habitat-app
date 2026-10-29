import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { hasStartedAttendance } from "../lib/attendance-start";

const modules = import.meta.glob("./**/*.ts");
const inspect = makeFunctionReference<"query", Record<string, never>>("attendanceStartMigration:inspectAttendanceStartDates");
const backfill = makeFunctionReference<"mutation", {
  expectedChildCount: number;
  overrides?: { childId: string; attendanceStartDate: string }[];
}>("attendanceStartMigration:backfillAttendanceStartDates");

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

  it("applies explicit overrides to legacy and configured children atomically and only audits changes", async () => {
    const t = await setup();
    const args = {
      expectedChildCount: 3,
      overrides: [
        { childId: "existing", attendanceStartDate: "2026-10-19" },
        { childId: "newer", attendanceStartDate: "2026-11-02" },
      ],
    };
    expect(await t.mutation(backfill, args)).toMatchObject({ totalChildren: 3, changedChildren: 3, missingStartDate: 0 });
    const after = await t.run(({ db }) => db.query("children").collect());
    expect(Object.fromEntries(after.map(child => [child.id, child.attendanceStartDate]))).toEqual({
      existing: "2026-10-19", inactive: "2026-09-01", newer: "2026-11-02",
    });
    const audits = await t.run(({ db }) => db.query("auditLogs").collect());
    expect(audits).toHaveLength(3);
    expect(audits.find(row => row.entityId === "newer")).toMatchObject({
      previousValue: { attendanceStartDate: "2026-10-13" },
      newValue: { attendanceStartDate: "2026-11-02" },
    });
    expect(await t.mutation(backfill, args)).toMatchObject({ changedChildren: 0 });
    expect(await t.run(({ db }) => db.query("children").collect())).toEqual(after);
    expect(await t.run(({ db }) => db.query("auditLogs").collect())).toEqual(audits);
  });

  it("initializes seventeen children with one inclusive October 19 start", async () => {
    const t = convexTest(schema, modules);
    await t.run(async ({ db }) => {
      for (let index = 0; index < 17; index++) {
        await db.insert("children", { id: `child-${index}`, firstName: "Test", lastName: String(index), active: true, createdAt: 1, updatedAt: 1 });
      }
    });
    expect(await t.mutation(backfill, {
      expectedChildCount: 17,
      overrides: [{ childId: "child-16", attendanceStartDate: "2026-10-19" }],
    })).toEqual({ totalChildren: 17, changedChildren: 17, missingStartDate: 0 });
    const children = await t.run(({ db }) => db.query("children").collect());
    expect(children.filter(child => child.attendanceStartDate === "2026-09-01")).toHaveLength(16);
    const laterChild = children.find(child => child.id === "child-16")!;
    expect(laterChild.attendanceStartDate).toBe("2026-10-19");
    expect(hasStartedAttendance(laterChild, new Date("2026-10-18T21:59:59.999Z"))).toBe(false);
    expect(hasStartedAttendance(laterChild, new Date("2026-10-18T22:00:00.000Z"))).toBe(true);
  });

  it.each([
    { name: "invalid date", overrides: [{ childId: "existing", attendanceStartDate: "2026-02-30" }], error: "Neplatné datum nástupu" },
    { name: "unknown child", overrides: [{ childId: "unknown", attendanceStartDate: "2026-10-19" }], error: "Unknown child" },
    { name: "duplicate child", overrides: [{ childId: "existing", attendanceStartDate: "2026-10-19" }, { childId: "existing", attendanceStartDate: "2026-10-20" }], error: "Duplicate child" },
  ])("rejects an $name override without changing any child or audit", async ({ overrides, error }) => {
    const t = await setup();
    const before = await t.run(({ db }) => db.query("children").collect());
    await expect(t.mutation(backfill, { expectedChildCount: 3, overrides })).rejects.toThrow(error);
    expect(await t.run(({ db }) => db.query("children").collect())).toEqual(before);
    expect(await t.run(({ db }) => db.query("auditLogs").collect())).toEqual([]);
  });
});
