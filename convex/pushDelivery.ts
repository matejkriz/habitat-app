"use node";

import { v } from "convex/values";
import webpush from "web-push";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  getRetryDelayMs,
  isExpiredSubscriptionStatus,
} from "./pushDeliveryPolicy";

function getStatusCode(error: unknown): number | null {
  if (!error || typeof error !== "object" || !("statusCode" in error)) return null;
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof statusCode === "number" ? statusCode : null;
}

function getErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 500);
}

export const deliver = internalAction({
  args: { deliveryId: v.id("notificationDeliveries") },
  returns: v.null(),
  handler: async (ctx, { deliveryId }) => {
    const claimed = await ctx.runMutation(internal.pushNotifications.claimDelivery, {
      deliveryId,
    });
    if (!claimed) return null;

    try {
      const subject = process.env.VAPID_SUBJECT;
      const publicKey = process.env.VAPID_PUBLIC_KEY;
      const privateKey = process.env.VAPID_PRIVATE_KEY;
      if (!subject || !publicKey || !privateKey) {
        throw new Error("VAPID configuration is incomplete");
      }

      webpush.setVapidDetails(subject, publicKey, privateKey);
      await webpush.sendNotification(
        claimed.subscription,
        JSON.stringify({
          title: claimed.event.title,
          body: claimed.event.body,
          url: claimed.event.url,
          tag: `notification-${claimed.event.id}`,
        }),
        { TTL: 3 * 24 * 60 * 60, urgency: "high" },
      );
      await ctx.runMutation(internal.pushNotifications.markDeliverySent, {
        deliveryId,
      });
    } catch (error) {
      const statusCode = getStatusCode(error);
      const invalidSubscription = isExpiredSubscriptionStatus(statusCode);
      const retryDelayMs = invalidSubscription
        ? null
        : getRetryDelayMs(claimed.attemptCount);
      await ctx.runMutation(internal.pushNotifications.markDeliveryFailed, {
        deliveryId,
        error: getErrorMessage(error),
        retryDelayMs,
        removeSubscription: invalidSubscription,
      });
    }
    return null;
  },
});
