import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireServerSecret } from "./serverSecret";

export const createParentExcuses = mutation({
  args: {
    secret: v.string(),
    parentId: v.string(),
    requestId: v.string(),
    childIds: v.array(v.string()),
    fromDate: v.number(),
    toDate: v.number(),
    reason: v.union(v.string(), v.null()),
    cancelLunch: v.boolean(),
    dayPart: v.optional(v.union(v.literal("FULL_DAY"), v.literal("MORNING"), v.literal("AFTERNOON"))),
  },
  handler: async (ctx, args) => {
    requireServerSecret(args.secret);
    if (
      args.requestId.length < 16 ||
      args.requestId.length > 100 ||
      !args.childIds.length ||
      new Set(args.childIds).size !== args.childIds.length ||
      !Number.isFinite(args.fromDate) ||
      !Number.isFinite(args.toDate) ||
      args.toDate < args.fromDate ||
      args.toDate - args.fromDate > 31 * 86400000
    ) {
      throw new Error("Neplatná omluvenka");
    }
    const parent = await ctx.db
      .query("users")
      .withIndex("by_app_id", (q) => q.eq("id", args.parentId))
      .unique();
    if (parent?.role !== "PARENT") throw new Error("Unauthorized");
    const children = [];
    for (const childId of args.childIds) {
      const child = await ctx.db
        .query("children")
        .withIndex("by_app_id", (q) => q.eq("id", childId))
        .unique();
      const link = await ctx.db
        .query("parentChildren")
        .withIndex("by_parent_child", (q) =>
          q.eq("parentId", args.parentId).eq("childId", childId),
        )
        .unique();
      if (!child?.active || !link)
        throw new Error("Dítě nebylo nalezeno nebo k němu nemáte přístup");
      children.push(child);
    }
    const fingerprint = JSON.stringify([
      args.childIds,
      args.fromDate,
      args.toDate,
      args.reason,
      args.cancelLunch,
      args.dayPart ?? "FULL_DAY",
    ]);
    const previous = await ctx.db
      .query("parentExcuseRequests")
      .withIndex("by_parent_request", (q) =>
        q.eq("parentId", args.parentId).eq("requestId", args.requestId),
      )
      .unique();
    if (previous) {
      if (previous.fingerprint !== fingerprint)
        throw new Error("Obsah opakovaného požadavku se změnil");
      const excuses = await Promise.all(
        previous.excuseIds.map((id) =>
          ctx.db
            .query("excuses")
            .withIndex("by_app_id", (q) => q.eq("id", id))
            .unique(),
        ),
      );
      if (excuses.some((excuse) => !excuse))
        throw new Error("Omluvenka již byla smazána. Odešlete nový formulář.");
      return { replayed: true, excuses: excuses.map((excuse) => excuse!) };
    }
    const now = Date.now();
    const excuses = [];
    for (const child of children) {
      const id: string = `parent-${args.parentId}-${args.requestId}-${excuses.length}`;
      const cancelLunch = child.doesNotTakeLunch ? true : args.cancelLunch;
      const value = {
        id,
        childId: child.id,
        fromDate: args.fromDate,
        toDate: args.toDate,
        reason: args.reason,
        dayPart: args.fromDate === args.toDate ? args.dayPart ?? "FULL_DAY" : "FULL_DAY",
        cancelLunch,
        submittedById: args.parentId,
        submittedAt: now,
        lateApprovedAt: child.doesNotTakeLunch || !cancelLunch ? now : null,
        lateApprovedById: null,
        createdAt: now,
        updatedAt: now,
      };
      await ctx.db.insert("excuses", value);
      await ctx.db.insert("auditLogs", {
        id: `audit-${id}`,
        userId: args.parentId,
        action: "CREATE",
        entityType: "Excuse",
        entityId: id,
        newValue: {
          childId: child.id,
          fromDate: new Date(args.fromDate).toISOString(),
          toDate: new Date(args.toDate).toISOString(),
          reason: args.reason,
          dayPart: value.dayPart,
          cancelLunch,
        },
        createdAt: now,
      });
      await ctx.scheduler.runAfter(
        0,
        internal.pushNotifications.enqueueExcuseInternal,
        { excuseId: id },
      );
      excuses.push(value);
    }
    await ctx.db.insert("parentExcuseRequests", {
      parentId: args.parentId,
      requestId: args.requestId,
      fingerprint,
      excuseIds: excuses.map((excuse) => excuse.id),
      createdAt: now,
    });
    return { replayed: false, excuses };
  },
});
