import { v } from "convex/values";
import { DEFAULT_ATTENDANCE_START_DATE, parseAttendanceStartDate } from "../lib/attendance-start";
import { internalMutation, internalQuery } from "./_generated/server";

const MIGRATION_ID = "initialize-attendance-start-2026-10-29";

export const inspectAttendanceStartDates = internalQuery({
  args: {},
  handler: async ({ db }) => {
    const children = await db.query("children").collect();
    return {
      totalChildren: children.length,
      missingStartDate: children.filter(child => child.attendanceStartDate === undefined).length,
    };
  },
});

export const backfillAttendanceStartDates = internalMutation({
  args: {
    expectedChildCount: v.number(),
    overrides: v.optional(v.array(v.object({ childId: v.string(), attendanceStartDate: v.string() }))),
  },
  handler: async ({ db }, { expectedChildCount, overrides = [] }) => {
    const children = await db.query("children").collect();
    if (!Number.isInteger(expectedChildCount) || expectedChildCount < 0) {
      throw new Error("Expected child count must be a nonnegative integer");
    }
    if (children.length !== expectedChildCount) {
      throw new Error(`Expected ${expectedChildCount} children, found ${children.length}`);
    }
    const childIds = new Set(children.map(child => child.id));
    const overrideDates = new Map<string, string>();
    for (const override of overrides) {
      if (overrideDates.has(override.childId)) throw new Error(`Duplicate child override: ${override.childId}`);
      if (!childIds.has(override.childId)) throw new Error(`Unknown child override: ${override.childId}`);
      overrideDates.set(override.childId, parseAttendanceStartDate(override.attendanceStartDate));
    }
    const now = Date.now();
    let changedChildren = 0;
    for (const child of children) {
      const attendanceStartDate = overrideDates.get(child.id) ?? child.attendanceStartDate ?? DEFAULT_ATTENDANCE_START_DATE;
      if (child.attendanceStartDate === attendanceStartDate) continue;
      await db.patch(child._id, { attendanceStartDate, updatedAt: now });
      await db.insert("auditLogs", {
        id: `${MIGRATION_ID}:${child.id}:${now}`, userId: null, action: "UPDATE", entityType: "Child", entityId: child.id,
        previousValue: { attendanceStartDate: child.attendanceStartDate ?? null },
        newValue: { attendanceStartDate, migrationId: MIGRATION_ID }, createdAt: now,
      });
      changedChildren++;
    }
    return { totalChildren: children.length, changedChildren, missingStartDate: 0 };
  },
});
