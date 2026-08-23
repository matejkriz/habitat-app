import { v } from "convex/values";
import {
  internalMutation,
  mutation,
  type MutationCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { buildExcuseNotificationBody } from "./notificationContent";

export const DIRECTOR_EXCUSE_TOPIC = "DIRECTOR_EXCUSE_CREATED";
const DELIVERY_LEASE_MS = 5 * 60 * 1000;
const EXCUSE_RECONCILIATION_CURSOR = "EXCUSE_CREATED";

function requireServerSecret(secret: string): void {
  const expected = process.env.PUSH_INTERNAL_SECRET;
  if (!expected || secret !== expected) {
    throw new Error("Unauthorized");
  }
}

async function isDirector(ctx: MutationCtx, userId: string): Promise<boolean> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_app_id", (query) => query.eq("id", userId))
    .unique();
  return user?.role === "DIRECTOR";
}

async function enqueueExcuseEvent(
  ctx: MutationCtx,
  excuse: Doc<"excuses">,
): Promise<Id<"notificationEvents"> | null> {
  const dedupeKey = `EXCUSE_CREATED:${excuse.id}`;
  const existing = await ctx.db
    .query("notificationEvents")
    .withIndex("by_dedupe_key", (query) => query.eq("dedupeKey", dedupeKey))
    .unique();
  if (existing) return existing._id;

  const child = await ctx.db
    .query("children")
    .withIndex("by_app_id", (query) => query.eq("id", excuse.childId))
    .unique();
  if (!child) return null;

  const now = Date.now();
  const eventId = await ctx.db.insert("notificationEvents", {
    dedupeKey,
    type: "EXCUSE_CREATED",
    title: "Nová omluvenka",
    body: buildExcuseNotificationBody({
      childFirstName: child.firstName,
      childLastName: child.lastName,
      fromTimestamp: excuse.fromDate,
      toTimestamp: excuse.toDate,
      reason: excuse.reason,
    }),
    url: "/reditel/omluvenky",
    createdAt: now,
  });

  const subscriptions = await ctx.db.query("pushSubscriptions").collect();
  for (const subscription of subscriptions) {
    if (
      !subscription.topics.includes(DIRECTOR_EXCUSE_TOPIC) ||
      !(await isDirector(ctx, subscription.userId))
    ) {
      continue;
    }

    const deliveryId = await ctx.db.insert("notificationDeliveries", {
      eventId,
      subscriptionId: subscription._id,
      status: "PENDING",
      attemptCount: 0,
      nextAttemptAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.pushDelivery.deliver, { deliveryId });
  }

  return eventId;
}

export const upsertDirectorSubscription = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireServerSecret(args.secret);
    if (!(await isDirector(ctx, args.userId))) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (query) => query.eq("endpoint", args.endpoint))
      .unique();
    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        userId: args.userId,
        p256dh: args.p256dh,
        auth: args.auth,
        topics: Array.from(new Set([...existing.topics, DIRECTOR_EXCUSE_TOPIC])),
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("pushSubscriptions", {
        userId: args.userId,
        endpoint: args.endpoint,
        p256dh: args.p256dh,
        auth: args.auth,
        topics: [DIRECTOR_EXCUSE_TOPIC],
        createdAt: now,
        updatedAt: now,
      });
    }
    return null;
  },
});

export const removeDirectorSubscription = mutation({
  args: { secret: v.string(), userId: v.string(), endpoint: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireServerSecret(args.secret);
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (query) => query.eq("endpoint", args.endpoint))
      .unique();
    if (!existing || existing.userId !== args.userId) return null;

    const topics = existing.topics.filter((topic) => topic !== DIRECTOR_EXCUSE_TOPIC);
    if (topics.length === 0) {
      await ctx.db.delete(existing._id);
    } else {
      await ctx.db.patch(existing._id, { topics, updatedAt: Date.now() });
    }
    return null;
  },
});

export const enqueueExcuse = mutation({
  args: { secret: v.string(), excuseId: v.string() },
  returns: v.union(v.null(), v.id("notificationEvents")),
  handler: async (ctx, args) => {
    requireServerSecret(args.secret);
    const excuse = await ctx.db
      .query("excuses")
      .withIndex("by_app_id", (query) => query.eq("id", args.excuseId))
      .unique();
    return excuse ? await enqueueExcuseEvent(ctx, excuse) : null;
  },
});

export const reconcileExcuseNotifications = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    const cursor = await ctx.db
      .query("notificationCursors")
      .withIndex("by_key", (query) =>
        query.eq("key", EXCUSE_RECONCILIATION_CURSOR),
      )
      .unique();
    const cutoff = cursor?.lastProcessedAt ?? now - 15 * 60 * 1000;
    const excuses = await ctx.db
      .query("excuses")
      .withIndex("by_submitted_at", (query) => query.gte("submittedAt", cutoff))
      .collect();
    let enqueued = 0;
    for (const excuse of excuses) {
      if (excuse.submittedAt > now) continue;
      const before = await ctx.db
        .query("notificationEvents")
        .withIndex("by_dedupe_key", (query) =>
          query.eq("dedupeKey", `EXCUSE_CREATED:${excuse.id}`),
        )
        .unique();
      if (!before && (await enqueueExcuseEvent(ctx, excuse))) enqueued += 1;
    }

    if (cursor) {
      await ctx.db.patch(cursor._id, { lastProcessedAt: now, updatedAt: now });
    } else {
      await ctx.db.insert("notificationCursors", {
        key: EXCUSE_RECONCILIATION_CURSOR,
        lastProcessedAt: now,
        updatedAt: now,
      });
    }
    return enqueued;
  },
});

export const recoverDueDeliveries = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    let scheduled = 0;
    for (const status of ["PENDING", "RETRY", "PROCESSING"]) {
      const due = await ctx.db
        .query("notificationDeliveries")
        .withIndex("by_status_next_attempt", (query) =>
          query.eq("status", status).lte("nextAttemptAt", now),
        )
        .take(100);
      for (const delivery of due) {
        await ctx.scheduler.runAfter(0, internal.pushDelivery.deliver, {
          deliveryId: delivery._id,
        });
        scheduled += 1;
      }
    }
    return scheduled;
  },
});

export const claimDelivery = internalMutation({
  args: { deliveryId: v.id("notificationDeliveries") },
  returns: v.any(),
  handler: async (ctx, { deliveryId }) => {
    const delivery = await ctx.db.get(deliveryId);
    const now = Date.now();
    if (
      !delivery ||
      delivery.status === "SENT" ||
      delivery.status === "FAILED" ||
      delivery.nextAttemptAt > now
    ) {
      return null;
    }

    const [event, subscription] = await Promise.all([
      ctx.db.get(delivery.eventId),
      ctx.db.get(delivery.subscriptionId),
    ]);
    if (!event || !subscription) {
      await ctx.db.patch(deliveryId, {
        status: "FAILED",
        lastError: "Notification event or subscription no longer exists",
        updatedAt: now,
      });
      return null;
    }

    const leaseUntil = now + DELIVERY_LEASE_MS;
    await ctx.db.patch(deliveryId, {
      status: "PROCESSING",
      attemptCount: delivery.attemptCount + 1,
      leaseUntil,
      nextAttemptAt: leaseUntil,
      updatedAt: now,
    });
    return {
      attemptCount: delivery.attemptCount + 1,
      event: {
        id: event._id,
        title: event.title,
        body: event.body,
        url: event.url,
      },
      subscription: {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
    };
  },
});

export const markDeliverySent = internalMutation({
  args: { deliveryId: v.id("notificationDeliveries") },
  returns: v.null(),
  handler: async (ctx, { deliveryId }) => {
    const delivery = await ctx.db.get(deliveryId);
    if (delivery?.status === "PROCESSING") {
      const now = Date.now();
      await ctx.db.patch(deliveryId, {
        status: "SENT",
        sentAt: now,
        leaseUntil: undefined,
        lastError: undefined,
        updatedAt: now,
      });
    }
    return null;
  },
});

export const markDeliveryFailed = internalMutation({
  args: {
    deliveryId: v.id("notificationDeliveries"),
    error: v.string(),
    retryDelayMs: v.union(v.null(), v.number()),
    removeSubscription: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery || delivery.status !== "PROCESSING") return null;
    const now = Date.now();

    if (args.removeSubscription) {
      const subscription = await ctx.db.get(delivery.subscriptionId);
      if (subscription) await ctx.db.delete(subscription._id);
    }

    if (args.retryDelayMs === null) {
      await ctx.db.patch(args.deliveryId, {
        status: "FAILED",
        leaseUntil: undefined,
        lastError: args.error,
        updatedAt: now,
      });
    } else {
      const nextAttemptAt = now + args.retryDelayMs;
      await ctx.db.patch(args.deliveryId, {
        status: "RETRY",
        leaseUntil: undefined,
        lastError: args.error,
        nextAttemptAt,
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(
        args.retryDelayMs,
        internal.pushDelivery.deliver,
        { deliveryId: args.deliveryId },
      );
    }
    return null;
  },
});
