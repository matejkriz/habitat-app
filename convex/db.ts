import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireServerSecret } from "./serverSecret";

const tableName = v.union(
  v.literal("users"),
  v.literal("children"),
  v.literal("parentChildren"),
  v.literal("attendance"),
  v.literal("excuses"),
  v.literal("closedDays"),
  v.literal("noLunchDays"),
  v.literal("auditLogs"),
);

const documentValue = v.any();

export const list = query({
  args: { secret: v.string(), table: tableName },
  returns: v.array(v.any()),
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);
    return await db.query(args.table).collect();
  },
});

export const listExcusesOverlapping = query({
  args: {
    secret: v.string(),
    childId: v.optional(v.string()),
    from: v.number(),
    to: v.number(),
  },
  returns: v.array(v.any()),
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);
    const childId = args.childId;
    const candidates = childId
      ? await db
          .query("excuses")
          .withIndex("by_child_from_date", (query) =>
            query.eq("childId", childId).lte("fromDate", args.to),
          )
          .collect()
      : await db
          .query("excuses")
          .withIndex("by_from_date", (query) => query.lte("fromDate", args.to))
          .collect();

    return candidates.filter((excuse) => excuse.toDate >= args.from);
  },
});

export const setNoLunchDay = mutation({
  args: {
    secret: v.string(),
    id: v.string(),
    date: v.number(),
    noLunch: v.boolean(),
    recordedById: v.string(),
    now: v.number(),
  },
  returns: v.boolean(),
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);
    const existing = await db
      .query("noLunchDays")
      .withIndex("by_date", (query) => query.eq("date", args.date))
      .unique();

    if (!args.noLunch) {
      if (existing) await db.delete(existing._id);
      return false;
    }

    if (existing) {
      await db.patch(existing._id, {
        recordedById: args.recordedById,
        updatedAt: args.now,
      });
    } else {
      await db.insert("noLunchDays", {
        id: args.id,
        date: args.date,
        recordedById: args.recordedById,
        createdAt: args.now,
        updatedAt: args.now,
      });
    }

    return true;
  },
});

export const getById = query({
  args: { secret: v.string(), table: tableName, id: v.string() },
  returns: v.union(v.null(), v.any()),
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);
    return await db
      .query(args.table)
      .withIndex("by_app_id", (q) => q.eq("id", args.id))
      .unique();
  },
});

export const insert = mutation({
  args: { secret: v.string(), table: tableName, value: documentValue },
  returns: v.string(),
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);
    return await db.insert(args.table, args.value);
  },
});

export const patchById = mutation({
  args: {
    secret: v.string(),
    table: tableName,
    id: v.string(),
    patch: documentValue,
  },
  returns: v.boolean(),
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);
    const current = await db
      .query(args.table)
      .withIndex("by_app_id", (q) => q.eq("id", args.id))
      .unique();

    if (!current) {
      throw new Error(`Document not found in ${args.table} for id ${args.id}`);
    }

    await db.patch(current._id, args.patch);
    return true;
  },
});

export const deleteById = mutation({
  args: { secret: v.string(), table: tableName, id: v.string() },
  returns: v.boolean(),
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);
    const current = await db
      .query(args.table)
      .withIndex("by_app_id", (q) => q.eq("id", args.id))
      .unique();

    if (!current) {
      return false;
    }

    await db.delete(current._id);
    return true;
  },
});
