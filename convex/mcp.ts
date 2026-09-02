import { v } from "convex/values";
import type { GenericDatabaseReader } from "convex/server";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { DataModel, Doc } from "./_generated/dataModel";
import { requireServerSecret } from "./serverSecret";
import {
  buildMcpRecordId,
  MCP_WRITE_LIMIT_PER_HOUR,
  validateMcpExcuseInput,
} from "./mcpPolicy";

const HOUR_MS = 60 * 60 * 1000;

async function getParentByWorkosId(
  db: GenericDatabaseReader<DataModel>,
  workosUserId: string,
) {
  const user = await db
    .query("users")
    .withIndex("by_workos_id", (q) => q.eq("workosId", workosUserId))
    .unique();
  return user?.role === "PARENT" ? user : null;
}

export const getParentProfile = query({
  args: { secret: v.string(), workosUserId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      userId: v.string(),
      children: v.array(
        v.object({
          id: v.string(),
          firstName: v.string(),
          gender: v.union(v.literal("MALE"), v.literal("FEMALE"), v.null()),
        }),
      ),
    }),
  ),
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);
    const parent = await getParentByWorkosId(db, args.workosUserId);
    if (!parent) return null;

    const links = await db
      .query("parentChildren")
      .withIndex("by_parent_id", (q) => q.eq("parentId", parent.id))
      .collect();
    const children = [];
    for (const link of links) {
      const child = await db
        .query("children")
        .withIndex("by_app_id", (q) => q.eq("id", link.childId))
        .unique();
      if (child?.active) {
        children.push({
          id: child.id,
          firstName: child.firstName,
          gender: child.gender ?? null,
        });
      }
    }

    return { userId: parent.id, children };
  },
});

export const createParentExcuses = mutation({
  args: {
    secret: v.string(),
    workosUserId: v.string(),
    requestId: v.string(),
    childIds: v.array(v.string()),
    fromDate: v.number(),
    toDate: v.number(),
    reason: v.union(v.string(), v.null()),
  },
  returns: v.object({
    replayed: v.boolean(),
    submittedAt: v.number(),
    excuses: v.array(
      v.object({
        id: v.string(),
        childId: v.string(),
        fromDate: v.number(),
        toDate: v.number(),
        lateApprovedAt: v.union(v.number(), v.null()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    requireServerSecret(args.secret);
    const childIds = validateMcpExcuseInput(args);
    const parent = await getParentByWorkosId(ctx.db, args.workosUserId);
    if (!parent) throw new Error("Unauthorized MCP parent");

    const existing = await ctx.db
      .query("mcpExcuseRequests")
      .withIndex("by_request_id", (q) => q.eq("requestId", args.requestId))
      .unique();
    if (existing) {
      const sameRequest =
        existing.workosUserId === args.workosUserId &&
        existing.fromDate === args.fromDate &&
        existing.toDate === args.toDate &&
        existing.reason === args.reason &&
        existing.childIds.length === childIds.length &&
        existing.childIds.every((childId, index) => childId === childIds[index]);
      if (!sameRequest) throw new Error("MCP idempotency conflict");
      const storedExcuses = await Promise.all(
        existing.excuseIds.map((id) =>
          ctx.db
            .query("excuses")
            .withIndex("by_app_id", (q) => q.eq("id", id))
            .unique(),
        ),
      );
      if (storedExcuses.some((excuse) => !excuse)) {
        throw new Error("MCP idempotency record is incomplete");
      }
      return {
        replayed: true,
        submittedAt: existing.createdAt,
        excuses: existing.excuseIds.map((id, index) => ({
          id,
          childId: existing.childIds[index],
          fromDate: existing.fromDate,
          toDate: existing.toDate,
          lateApprovedAt: storedExcuses[index]?.lateApprovedAt ?? null,
        })),
      };
    }

    const recentRequests = await ctx.db
      .query("mcpExcuseRequests")
      .withIndex("by_user_created_at", (q) =>
        q.eq("userId", parent.id).gte("createdAt", Date.now() - HOUR_MS),
      )
      .take(MCP_WRITE_LIMIT_PER_HOUR);
    if (recentRequests.length >= MCP_WRITE_LIMIT_PER_HOUR) {
      throw new Error("MCP write rate limit exceeded");
    }

    const childrenById = new Map<string, Doc<"children">>();
    for (const childId of childIds) {
      const [link, child] = await Promise.all([
        ctx.db
          .query("parentChildren")
          .withIndex("by_parent_child", (q) =>
            q.eq("parentId", parent.id).eq("childId", childId),
          )
          .unique(),
        ctx.db
          .query("children")
          .withIndex("by_app_id", (q) => q.eq("id", childId))
          .unique(),
      ]);
      if (!link || !child?.active) throw new Error("MCP child access denied");
      childrenById.set(childId, child);
    }

    const submittedAt = Date.now();
    const excuseIds: string[] = [];
    for (const [index, childId] of childIds.entries()) {
      const excuseId = buildMcpRecordId("excuse", args.requestId, index);
      const automaticallyApproved =
        childrenById.get(childId)?.doesNotTakeLunch ?? false;
      const lateApprovedAt = automaticallyApproved ? submittedAt : null;
      excuseIds.push(excuseId);
      await ctx.db.insert("excuses", {
        id: excuseId,
        childId,
        fromDate: args.fromDate,
        toDate: args.toDate,
        reason: args.reason,
        cancelLunch: true,
        submittedById: parent.id,
        submittedAt,
        lateApprovedAt,
        lateApprovedById: null,
        createdAt: submittedAt,
        updatedAt: submittedAt,
      });
      await ctx.db.insert("auditLogs", {
        id: buildMcpRecordId("audit", args.requestId, index),
        userId: parent.id,
        action: "CREATE",
        entityType: "Excuse",
        entityId: excuseId,
        newValue: {
          source: "MCP",
          childId,
          fromDate: new Date(args.fromDate).toISOString(),
          toDate: new Date(args.toDate).toISOString(),
          reason: args.reason,
          cancelLunch: true,
          automaticallyApproved,
        },
        createdAt: submittedAt,
      });
      await ctx.scheduler.runAfter(
        0,
        internal.pushNotifications.enqueueExcuseInternal,
        { excuseId },
      );
    }

    await ctx.db.insert("mcpExcuseRequests", {
      requestId: args.requestId,
      workosUserId: args.workosUserId,
      userId: parent.id,
      childIds,
      excuseIds,
      fromDate: args.fromDate,
      toDate: args.toDate,
      reason: args.reason,
      createdAt: submittedAt,
    });

    return {
      replayed: false,
      submittedAt,
      excuses: excuseIds.map((id, index) => ({
        id,
        childId: childIds[index],
        fromDate: args.fromDate,
        toDate: args.toDate,
        lateApprovedAt:
          childrenById.get(childIds[index])?.doesNotTakeLunch
            ? submittedAt
            : null,
      })),
    };
  },
});
