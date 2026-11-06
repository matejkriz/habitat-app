import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { validateDayDetails } from "../lib/day-details";

const DAY_MS = 24 * 60 * 60 * 1000;
const SYSTEM_ACTOR = "system:meal-sync";
const pragueDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit",
});

function calendarDate(timestamp: number): string {
  const parts = Object.fromEntries(pragueDate.formatToParts(timestamp).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function utcMidnight(date: string): number {
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(timestamp) ||
      new Date(timestamp).toISOString().slice(0, 10) !== date) {
    throw new Error("Invalid meal calendar date");
  }
  return timestamp;
}

/** Only a complete, authenticated snapshot may call this internal write. */
export const applySnapshot = internalMutation({
  args: {
    days: v.array(v.object({ date: v.string(), meal: v.union(v.string(), v.null()), mealCount: v.number() })),
    startedAt: v.number(),
  },
  returns: v.object({ updated: v.number(), unchanged: v.number(), skipped: v.number() }),
  handler: async ({ db }, { days, startedAt }) => {
    if (!Number.isSafeInteger(startedAt) || startedAt < 0 || days.length > 31) {
      throw new Error("Invalid meal snapshot");
    }
    const dates = new Set<string>();
    const snapshot = days.map(day => {
      const timestamp = utcMidnight(day.date);
      if (dates.has(day.date)) throw new Error("Duplicate meal calendar date");
      dates.add(day.date);
      validateDayDetails(day);
      const meal = day.mealCount === 0 ? null : day.meal?.trim() || null;
      if (day.mealCount > 0 && meal === null) throw new Error("Ordered meals must include a description");
      return { ...day, meal, timestamp };
    });

    const result = { updated: 0, unchanged: 0, skipped: 0 };
    for (const day of snapshot) {
      // Existing data can contain Prague midnight from a local runtime. Reuse
      // that row instead of inserting a second record for the same school day.
      const nearby = await db.query("dayDetails").withIndex("by_date", query =>
        query.gte("date", day.timestamp - DAY_MS / 2).lt("date", day.timestamp + DAY_MS * 1.5)).collect();
      const matching = nearby.filter(row => calendarDate(row.date) === day.date);
      const exact = matching.filter(row => row.date === day.timestamp);
      const current = exact[0] ?? matching[0];
      if (exact.length > 1 || (matching.length > 1 && exact.length === 0)) {
        throw new Error("Ambiguous meal calendar date");
      }
      if (current && ((current.mealSyncedAt ?? -1) >= startedAt || current.updatedAt > startedAt)) {
        result.skipped++;
        continue;
      }

      if (current && (current.meal ?? null) === day.meal && (current.mealCount ?? null) === day.mealCount) {
        await db.patch(current._id, { mealSyncedAt: startedAt });
        result.unchanged++;
        continue;
      }
      const updatedAt = Date.now();
      const patch = {
        meal: day.meal, mealCount: day.mealCount, mealSyncedAt: startedAt,
        recordedById: SYSTEM_ACTOR, updatedAt,
      };
      if (current) await db.patch(current._id, patch);
      else await db.insert("dayDetails", { date: day.timestamp, ...patch });
      await db.insert("auditLogs", {
        id: `meal_sync_${day.date}_${startedAt}`, userId: SYSTEM_ACTOR,
        action: "UPDATE", entityType: "DayDetails", entityId: String(current?.date ?? day.timestamp),
        previousValue: { meal: current?.meal ?? null, mealCount: current?.mealCount ?? null },
        newValue: { meal: day.meal, mealCount: day.mealCount, source: "canteen" },
        createdAt: updatedAt,
      });
      result.updated++;
    }
    return result;
  },
});
