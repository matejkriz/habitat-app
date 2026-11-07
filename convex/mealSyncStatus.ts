import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const recordResult = internalMutation({
  args: {
    startedAt: v.number(),
    success: v.boolean(),
    errorCode: v.optional(v.union(v.literal("AUTH"), v.literal("NETWORK"), v.literal("PROTOCOL"), v.literal("CONFIG"), v.literal("INTERNAL"))),
    daysRead: v.optional(v.number()),
    updated: v.optional(v.number()),
    unchanged: v.optional(v.number()),
    skipped: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async ({ db }, args) => {
    const current = await db.query("mealSyncState").withIndex("by_key", q => q.eq("key", "ejidelnicek")).unique();
    const success = args.success ? {
      lastSuccessAt: Math.max(Date.now(), current?.lastSuccessAt ?? 0), daysRead: args.daysRead ?? 0,
      updated: args.updated ?? 0, unchanged: args.unchanged ?? 0, skipped: args.skipped ?? 0,
    } : {};
    if (current && current.lastAttemptAt > args.startedAt) {
      if (args.success) await db.patch(current._id, { ...success, consecutiveFailures: 0 });
      return null;
    }
    const result = {
      lastAttemptAt: args.startedAt,
      lastErrorCode: args.success ? undefined : args.errorCode ?? "INTERNAL",
      consecutiveFailures: args.success ? 0 : (current?.consecutiveFailures ?? 0) + 1,
      ...success,
    };
    if (current) await db.patch(current._id, result);
    else await db.insert("mealSyncState", { key: "ejidelnicek", ...result });
    return null;
  },
});
