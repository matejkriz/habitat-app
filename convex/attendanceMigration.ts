import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery, type QueryCtx } from "./_generated/server";

const MIGRATION_ID = "initialize-full-attendance-2026-09-27";
const FULL_ATTENDANCE = [1, 2, 3, 4];

function hasFullAttendance(child: Doc<"children">) {
  return child.attendanceDays?.length === FULL_ATTENDANCE.length &&
    child.attendanceDays.every((day, index) => day === FULL_ATTENDANCE[index]);
}

async function inspect(ctx: QueryCtx) {
  const children = await ctx.db.query("children").collect();
  const marker = await ctx.db.query("auditLogs")
    .withIndex("by_app_id", q => q.eq("id", MIGRATION_ID)).unique();
  const schedules = new Map<string, { attendanceDays: number[] | null; count: number }>();
  let missingSchedule = 0;
  let fullSchedule = 0;
  for (const child of children) {
    const attendanceDays = child.attendanceDays ?? null;
    const key = JSON.stringify(attendanceDays);
    const entry = schedules.get(key) ?? { attendanceDays, count: 0 };
    entry.count++;
    schedules.set(key, entry);
    if (attendanceDays === null) missingSchedule++;
    else if (hasFullAttendance(child)) fullSchedule++;
  }
  return {
    children,
    report: {
      migrationId: MIGRATION_ID,
      completed: marker !== null,
      completedAt: marker?.createdAt ?? null,
      totalChildren: children.length,
      activeChildren: children.filter(child => child.active).length,
      inactiveChildren: children.filter(child => !child.active).length,
      missingSchedule,
      partialSchedule: children.length - missingSchedule - fullSchedule,
      fullSchedule,
      needsInitialization: children.length - fullSchedule,
      schedules: [...schedules.values()],
    },
  };
}

export const inspectFullAttendance = internalQuery({
  args: {},
  handler: async ctx => (await inspect(ctx)).report,
});

export const initializeFullAttendance = internalMutation({
  args: { expectedChildCount: v.number() },
  handler: async (ctx, args) => {
    const { children, report } = await inspect(ctx);
    if (!Number.isInteger(args.expectedChildCount) || args.expectedChildCount < 0) {
      throw new Error("Expected child count must be a nonnegative integer");
    }
    if (children.length !== args.expectedChildCount) {
      throw new Error(`Expected ${args.expectedChildCount} children, found ${children.length}`);
    }
    if (report.completed) {
      return { ...report, status: "already-completed", changedChildren: 0 };
    }

    const completedAt = Date.now();
    let changedChildren = 0;
    for (const child of children) {
      if (hasFullAttendance(child)) continue;
      await ctx.db.patch(child._id, { attendanceDays: FULL_ATTENDANCE, updatedAt: completedAt });
      await ctx.db.insert("auditLogs", {
        id: `${MIGRATION_ID}:${child.id}`, userId: null, action: "UPDATE",
        entityType: "Child", entityId: child.id,
        previousValue: { attendanceDays: child.attendanceDays ?? null },
        newValue: { attendanceDays: FULL_ATTENDANCE, migrationId: MIGRATION_ID },
        createdAt: completedAt,
      });
      changedChildren++;
    }
    // This marker commits atomically with the child updates and prevents a rerun
    // from resetting schedules subsequently configured by the director.
    await ctx.db.insert("auditLogs", {
      id: MIGRATION_ID, userId: null, action: "CREATE", entityType: "AttendanceMigration",
      entityId: MIGRATION_ID, newValue: { totalChildren: children.length, changedChildren, attendanceDays: FULL_ATTENDANCE },
      createdAt: completedAt,
    });
    return {
      ...(await inspect(ctx)).report,
      status: "completed",
      changedChildren,
    };
  },
});
