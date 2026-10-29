import { v } from "convex/values";
import { DEFAULT_ATTENDANCE_START_DATE } from "../lib/attendance-start";
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
  args: { expectedChildCount: v.number() },
  handler: async ({ db }, { expectedChildCount }) => {
    const children = await db.query("children").collect();
    if (!Number.isInteger(expectedChildCount) || expectedChildCount < 0) {
      throw new Error("Expected child count must be a nonnegative integer");
    }
    if (children.length !== expectedChildCount) {
      throw new Error(`Expected ${expectedChildCount} children, found ${children.length}`);
    }
    const now = Date.now();
    let changedChildren = 0;
    for (const child of children) {
      if (child.attendanceStartDate !== undefined) continue;
      await db.patch(child._id, { attendanceStartDate: DEFAULT_ATTENDANCE_START_DATE, updatedAt: now });
      await db.insert("auditLogs", {
        id: `${MIGRATION_ID}:${child.id}`, userId: null, action: "UPDATE", entityType: "Child", entityId: child.id,
        previousValue: { attendanceStartDate: null },
        newValue: { attendanceStartDate: DEFAULT_ATTENDANCE_START_DATE, migrationId: MIGRATION_ID }, createdAt: now,
      });
      changedChildren++;
    }
    return { totalChildren: children.length, changedChildren, missingStartDate: 0 };
  },
});
