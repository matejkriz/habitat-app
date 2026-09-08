import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireServerSecret } from "./serverSecret";
import type { Doc } from "./_generated/dataModel";
import { enqueueExcuseEvent } from "./pushNotifications";

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
const excuseDayPart = v.union(
  v.literal("FULL_DAY"),
  v.literal("MORNING"),
  v.literal("AFTERNOON"),
);
const excuseValue = v.object({
  id: v.string(),
  childId: v.string(),
  fromDate: v.number(),
  toDate: v.number(),
  reason: v.union(v.string(), v.null()),
  dayPart: v.optional(excuseDayPart),
  cancelLunch: v.boolean(),
  submittedById: v.string(),
  submittedAt: v.number(),
  lateApprovedAt: v.union(v.number(), v.null()),
  lateApprovedById: v.union(v.string(), v.null()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const list = query({
  args: { secret: v.string(), table: tableName },
  returns: v.array(v.any()),
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);
    return await db.query(args.table).collect();
  },
});

export const findUser = query({
  args: {
    secret: v.string(),
    id: v.optional(v.string()),
    workosId: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  returns: v.union(v.null(), v.any()),
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);

    if (args.id) {
      return await db
        .query("users")
        .withIndex("by_app_id", (query) => query.eq("id", args.id!))
        .first();
    }
    if (args.workosId) {
      return await db
        .query("users")
        .withIndex("by_workos_id", (query) =>
          query.eq("workosId", args.workosId!),
        )
        .first();
    }
    if (args.email) {
      return await db
        .query("users")
        .withIndex("by_email", (query) => query.eq("email", args.email!))
        .first();
    }

    return null;
  },
});

export const listChildren = query({
  args: {
    secret: v.string(),
    active: v.optional(v.boolean()),
  },
  returns: v.array(v.any()),
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);
    if (args.active !== undefined) {
      return await db
        .query("children")
        .withIndex("by_active", (query) => query.eq("active", args.active!))
        .collect();
    }
    return await db.query("children").collect();
  },
});

export const listParentChildren = query({
  args: {
    secret: v.string(),
    parentId: v.string(),
  },
  returns: v.array(v.any()),
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);
    const relations = await db
      .query("parentChildren")
      .withIndex("by_parent_id", (query) =>
        query.eq("parentId", args.parentId),
      )
      .collect();

    return await Promise.all(
      relations.map(async (relation) => ({
        ...relation,
        child: await db
          .query("children")
          .withIndex("by_app_id", (query) =>
            query.eq("id", relation.childId),
          )
          .first(),
      })),
    );
  },
});

export const getParentChild = query({
  args: {
    secret: v.string(),
    parentId: v.string(),
    childId: v.string(),
  },
  returns: v.union(v.null(), v.any()),
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);
    return await db
      .query("parentChildren")
      .withIndex("by_parent_child", (query) =>
        query.eq("parentId", args.parentId).eq("childId", args.childId),
      )
      .first();
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

export const createExcuse = mutation({
  args: { secret: v.string(), value: excuseValue },
  returns: excuseValue,
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);
    const value = args.value;

    const child = await db
      .query("children")
      .withIndex("by_app_id", (query) => query.eq("id", value.childId))
      .unique();
    if (!child) throw new Error("Child not found");

    const cancelLunch = child.doesNotTakeLunch ? true : value.cancelLunch;
    const dayPart =
      value.fromDate === value.toDate ? (value.dayPart ?? "FULL_DAY") : "FULL_DAY";
    const excuse = {
      ...value,
      dayPart,
      cancelLunch,
      lateApprovedAt:
        value.lateApprovedAt == null &&
        (child.doesNotTakeLunch || !cancelLunch)
          ? Date.now()
          : value.lateApprovedAt,
    };
    await db.insert("excuses", excuse);
    return excuse;
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
  handler: async (ctx, args) => {
    const { db } = ctx;
    requireServerSecret(args.secret);
    const current = await db
      .query(args.table)
      .withIndex("by_app_id", (q) => q.eq("id", args.id))
      .unique();

    if (!current) {
      throw new Error(`Document not found in ${args.table} for id ${args.id}`);
    }

    if (args.table === "excuses") {
      const previous = current as Doc<"excuses">;
      // Give each saved revision a distinct key, including concurrent edits.
      await db.patch(previous._id, {
        ...args.patch,
        updatedAt: Math.max(Date.now(), previous.updatedAt + 1),
      });
      const updated = await db.get(previous._id);
      if (updated && (
        previous.fromDate !== updated.fromDate ||
        previous.toDate !== updated.toDate ||
        (previous.reason ?? null) !== (updated.reason ?? null) ||
        (previous.dayPart ?? "FULL_DAY") !== (updated.dayPart ?? "FULL_DAY") ||
        (previous.cancelLunch ?? true) !== (updated.cancelLunch ?? true)
      )) {
        // The edit and its delivery records commit together or both roll back.
        await enqueueExcuseEvent(ctx, updated, "EXCUSE_UPDATED");
      }
    } else {
      await db.patch(current._id, args.patch);
    }
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
