"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { CanteenError, fetchCanteenDays } from "./canteenClient";

type SyncErrorCode = "AUTH" | "NETWORK" | "PROTOCOL" | "CONFIG" | "INTERNAL";
type SyncResult =
  | { status: "disabled" }
  | { status: "not_configured" }
  | { status: "failed"; errorCode: SyncErrorCode }
  | { status: "synced"; daysRead: number; updated: number; unchanged: number; skipped: number };

function dateRange(now: number) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now).map(({ type, value }) => [type, value]));
  const dateFrom = `${parts.year}-${parts.month}-${parts.day}`;
  const end = new Date(`${dateFrom}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 27);
  return { dateFrom, dateTo: end.toISOString().slice(0, 10) };
}

/** Credentials stay in this action's memory, never in scheduler or mutation arguments. */
export const run = internalAction({
  args: { attempt: v.optional(v.number()) },
  handler: async (ctx, { attempt = 0 }): Promise<SyncResult> => {
    if (process.env.EJIDELNICEK_SYNC_ENABLED !== "true") return { status: "disabled" };
    const startedAt = Date.now();
    const username = process.env.EJIDELNICEK_USERNAME;
    const password = process.env.EJIDELNICEK_PASSWORD;
    if (!username?.trim() || !password) {
      await ctx.runMutation(internal.mealSyncStatus.recordResult, { startedAt, success: false, errorCode: "CONFIG" });
      return { status: "not_configured" };
    }
    try {
      if (!Number.isInteger(attempt) || attempt < 0 || attempt > 2) throw new CanteenError("CONFIG");
      const days = await fetchCanteenDays({ username, password, ...dateRange(startedAt) });
      const applied = await ctx.runMutation(internal.mealSync.applySnapshot, { days, startedAt });
      await ctx.runMutation(internal.mealSyncStatus.recordResult, {
        startedAt, success: true, daysRead: days.length, ...applied,
      });
      return { status: "synced", daysRead: days.length, ...applied };
    } catch (error) {
      const errorCode: SyncErrorCode = error instanceof CanteenError ? error.code : "INTERNAL";
      await ctx.runMutation(internal.mealSyncStatus.recordResult, { startedAt, success: false, errorCode });
      if (errorCode === "NETWORK" && attempt < 2) {
        await ctx.scheduler.runAfter(attempt === 0 ? 60_000 : 300_000, internal.mealSyncJobs.run, { attempt: attempt + 1 });
      }
      return { status: "failed", errorCode };
    }
  },
});
