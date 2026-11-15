import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireServerSecret } from "./serverSecret";
import { canonicalDayRecord, toDayDateKey } from "../lib/day-date";

const calendar = v.union(v.literal("habitat"), v.literal("jidelnicek"));
const eventValue = v.object({
  id: v.string(), date: v.string(), summary: v.string(),
  description: v.optional(v.string()), updatedAt: v.number(),
  sequence: v.number(), cancelled: v.boolean(),
});

export const upsertSubscription = mutation({
  args: { secret: v.string(), userId: v.string(), nonce: v.string(), tokenHash: v.string(), signingKeyId: v.string(), rotate: v.boolean() },
  returns: v.string(),
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);
    const user = await db.query("users").withIndex("by_app_id", q => q.eq("id", args.userId)).unique();
    if (!user) throw new Error("Unauthorized");
    if (!/^[A-Za-z0-9_-]{43}$/.test(args.nonce) || !/^[a-f0-9]{64}$/.test(args.tokenHash) || !/^[a-f0-9]{64}$/.test(args.signingKeyId)) {
      throw new Error("Invalid subscription");
    }
    const existing = await db.query("calendarSubscriptions").withIndex("by_user", q => q.eq("userId", user.id)).unique();
    if (existing && !args.rotate && existing.signingKeyId === args.signingKeyId) return existing.nonce;
    const value = { userId: user.id, nonce: args.nonce, tokenHash: args.tokenHash, signingKeyId: args.signingKeyId, updatedAt: Date.now() };
    if (existing) await db.replace(existing._id, value);
    else await db.insert("calendarSubscriptions", value);
    return args.nonce;
  },
});

export const revokeSubscription = mutation({
  args: { secret: v.string(), userId: v.string() },
  returns: v.null(),
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);
    const existing = await db.query("calendarSubscriptions").withIndex("by_user", q => q.eq("userId", args.userId)).unique();
    if (existing) await db.delete(existing._id);
    return null;
  },
});

/**
 * A transaction publishes a complete snapshot plus durable revisions/cancellations.
 * No original calendar/attendance data is modified. Tokens are checked before reads
 * and before HTTP conditional responses; an old ETag cannot bypass revocation.
 */
export const readFeed = mutation({
  args: { secret: v.string(), tokenHash: v.string(), signingKeyId: v.string(), calendar },
  returns: v.union(v.null(), v.array(eventValue)),
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);
    if (!/^[a-f0-9]{64}$/.test(args.tokenHash)) return null;
    const subscription = await db.query("calendarSubscriptions")
      .withIndex("by_token_hash", q => q.eq("tokenHash", args.tokenHash)).unique();
    if (!subscription || subscription.signingKeyId !== args.signingKeyId) return null;
    const owner = await db.query("users").withIndex("by_app_id", q => q.eq("id", subscription.userId)).unique();
    if (!owner) return null;

    const now = Date.now();
    const today = Date.parse(`${toDayDateKey(now)}T00:00:00Z`);
    // A rolling publication window is independent of the month open in the UI.
    const fromKey = toDayDateKey(today - 90 * 86400000);
    const toKey = toDayDateKey(today + 548 * 86400000);
    const from = Date.parse(`${fromKey}T00:00:00Z`) - 43200000;
    const to = Date.parse(`${toKey}T00:00:00Z`) + 129600000;
    const [days, closedDays, published] = await Promise.all([
      db.query("dayDetails").withIndex("by_date", q => q.gte("date", from).lte("date", to)).collect(),
      args.calendar === "habitat"
        ? db.query("closedDays").withIndex("by_date", q => q.gte("date", from).lte("date", to)).collect()
        : [],
      db.query("calendarFeedEvents").withIndex("by_calendar_date", q =>
        q.eq("calendar", args.calendar).gte("date", fromKey).lte("date", toKey)).collect(),
    ]);
    const canonical = new Map<string, Doc<"dayDetails">>();
    for (const day of days) {
      const key = toDayDateKey(day.date);
      if (key < fromKey || key > toKey) continue;
      const previous = canonical.get(key);
      canonical.set(key, canonicalDayRecord(previous ? [previous, day] : [day], key)!);
    }

    type Candidate = { id: string; date: string; summary: string; description?: string; updatedAt: number };
    const candidates = new Map<string, Candidate>();
    for (const [date, day] of canonical) {
      const text = (args.calendar === "habitat" ? day.name : day.meal)?.trim();
      if (!text) continue;
      const id = `${args.calendar}:${date}`;
      candidates.set(id, {
        id, date,
        summary: args.calendar === "habitat" ? text : `Oběd: ${Array.from(text.split(/\r?\n/)[0]).slice(0, 120).join("")}`,
        ...(args.calendar === "jidelnicek" ? { description: text } : {}),
        updatedAt: day.updatedAt,
      });
    }
    const closures = new Map<string, Doc<"closedDays">>();
    for (const day of closedDays) {
      const date = toDayDateKey(day.date);
      if (date < fromKey || date > toKey) continue;
      const previous = closures.get(date);
      closures.set(date, canonicalDayRecord(previous ? [previous, day] : [day], date)!);
    }
    for (const [date, day] of closures) {
      const id = `closed:${date}`;
      candidates.set(id, { id, date, summary: day.description?.trim() ? `Zavřeno: ${day.description.trim()}` : "Habitat — zavřeno", updatedAt: day.updatedAt });
    }

    const result: Array<Candidate & { sequence: number; cancelled: boolean }> = [];
    for (const previous of published) {
      const candidate = candidates.get(previous.id);
      candidates.delete(previous.id);
      // Only exported fields affect the revision. Finance edits cannot leak through it.
      const changed = candidate
        ? previous.cancelled || candidate.summary !== previous.summary || candidate.description !== previous.description
        : !previous.cancelled;
      const value = {
        id: previous.id, date: previous.date,
        summary: candidate?.summary ?? previous.summary,
        ...(candidate?.description !== undefined || (!candidate && previous.description !== undefined)
          ? { description: candidate?.description ?? previous.description } : {}),
        updatedAt: changed ? Math.max(now, previous.updatedAt + 1000) : previous.updatedAt,
        sequence: previous.sequence + Number(changed), cancelled: !candidate,
      };
      if (changed) await db.replace(previous._id, { calendar: args.calendar, ...value });
      result.push(value);
    }
    for (const candidate of candidates.values()) {
      const value = { ...candidate, sequence: 0, cancelled: false };
      await db.insert("calendarFeedEvents", { calendar: args.calendar, ...value });
      result.push(value);
    }
    return result.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  },
});
