import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");
const secret = "calendar-test-server-secret";
const userId = "calendar-parent";
const nonce = "n".repeat(43);
const tokenHash = "a".repeat(64);
const signingKeyId = "d".repeat(64);
const date = Date.parse("2026-11-10T00:00:00Z");

async function fixture() {
  const t = convexTest(schema, modules);
  await t.run(async ({ db }) => {
    await db.insert("users", { id: userId, role: "PARENT", createdAt: date, updatedAt: date });
    await db.insert("dayDetails", {
      date, name: "Výlet do lesa", meal: "Polévka\nRizoto", mealCount: 27,
      expense: 500, recordedById: "private-director", updatedAt: date,
    });
    await db.insert("dayReports", { date, report: "Soukromý report", recordedById: "teacher", updatedAt: date });
  });
  await t.mutation(api.calendarFeeds.upsertSubscription, { secret, userId, nonce, tokenHash, signingKeyId, rotate: false });
  return t;
}

describe("calendar feed publication", () => {
  beforeEach(() => {
    vi.stubEnv("PUSH_INTERNAL_SECRET", secret);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-10T12:00:00Z"));
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

  it("publishes only shared fields, resolves UTC/Prague duplicates, and includes explicit closures only in Habitat", async () => {
    const t = await fixture();
    await t.run(async ({ db }) => {
      await db.insert("dayDetails", { date: date - 3600000, name: "Legacy duplicate", meal: "Legacy meal", recordedById: "teacher", updatedAt: date + 1 });
      await db.insert("closedDays", { id: "holiday", date: date + 86400000, description: "Prázdniny", createdAt: date, updatedAt: date });
      await db.insert("dayDetails", { date: date + 400 * 86400000, name: "Budoucí akce", recordedById: "teacher", updatedAt: date });
      await db.insert("dayDetails", { date: date - 100 * 86400000, name: "Příliš stará akce", recordedById: "teacher", updatedAt: date });
    });
    const program = await t.mutation(api.calendarFeeds.readFeed, { secret, tokenHash, signingKeyId, calendar: "habitat" });
    expect(program?.map(event => event.summary)).toEqual(["Výlet do lesa", "Zavřeno: Prázdniny", "Budoucí akce"]);
    const meal = await t.mutation(api.calendarFeeds.readFeed, { secret, tokenHash, signingKeyId, calendar: "jidelnicek" });
    expect(meal).toEqual([{ id: "jidelnicek:2026-11-10", date: "2026-11-10", summary: "Oběd: Polévka", description: "Polévka\nRizoto", updatedAt: date, sequence: 0, cancelled: false }]);
    const exported = JSON.stringify([program, meal]);
    for (const privateValue of ["mealCount", "expense", "recordedById", "private-director", "Soukromý report", "Legacy"]) {
      expect(exported).not.toContain(privateValue);
    }
  });

  it("keeps revisions stable for unrelated edits, tracks real changes, cancellations and reinstatement under one ID", async () => {
    const t = await fixture();
    const args = { secret, tokenHash, signingKeyId, calendar: "habitat" as const };
    const initial = (await t.mutation(api.calendarFeeds.readFeed, args))!;
    const day = (await t.run(({ db }) => db.query("dayDetails").first()))!;
    await t.run(({ db }) => db.patch(day._id, { expense: 600, updatedAt: date + 5000 }));
    expect(await t.mutation(api.calendarFeeds.readFeed, args)).toEqual(initial);
    await t.run(({ db }) => db.patch(day._id, { name: "Nový program", updatedAt: Date.now() }));
    const changed = (await t.mutation(api.calendarFeeds.readFeed, args))![0];
    expect(changed).toMatchObject({ id: initial[0].id, summary: "Nový program", sequence: 1, cancelled: false });
    await t.run(({ db }) => db.patch(day._id, { name: null, updatedAt: Date.now() }));
    const cancelled = (await t.mutation(api.calendarFeeds.readFeed, args))![0];
    expect(cancelled).toMatchObject({ id: initial[0].id, sequence: 2, cancelled: true });
    expect(cancelled.updatedAt).toBeGreaterThan(changed.updatedAt);
    expect(await t.mutation(api.calendarFeeds.readFeed, args)).toEqual([cancelled]);
    await t.run(({ db }) => db.patch(day._id, { name: "Náhradní program" }));
    expect((await t.mutation(api.calendarFeeds.readFeed, args))![0]).toMatchObject({ id: initial[0].id, sequence: 3, cancelled: false });
    await t.run(({ db }) => db.delete(day._id));
    expect((await t.mutation(api.calendarFeeds.readFeed, args))![0]).toMatchObject({ id: initial[0].id, sequence: 4, cancelled: true });
  });

  it("recovers existing links, rotates and revokes just this user's tokens, and rejects deleted owners", async () => {
    const t = await fixture();
    const replacement = { secret, userId, signingKeyId, nonce: "r".repeat(43), tokenHash: "b".repeat(64), rotate: false };
    expect(await t.mutation(api.calendarFeeds.upsertSubscription, replacement)).toBe(nonce);
    const read = { secret, tokenHash, signingKeyId, calendar: "habitat" as const };
    expect(await t.mutation(api.calendarFeeds.readFeed, read)).not.toBeNull();
    expect(await t.mutation(api.calendarFeeds.upsertSubscription, { ...replacement, rotate: true })).toBe(replacement.nonce);
    expect(await t.mutation(api.calendarFeeds.readFeed, read)).toBeNull();
    expect(await t.mutation(api.calendarFeeds.readFeed, { ...read, tokenHash: replacement.tokenHash })).not.toBeNull();
    await t.run(async ({ db }) => { const owner = (await db.query("users").first())!; await db.delete(owner._id); });
    expect(await t.mutation(api.calendarFeeds.readFeed, { ...read, tokenHash: replacement.tokenHash })).toBeNull();
    await t.mutation(api.calendarFeeds.revokeSubscription, { secret, userId });
    expect(await t.run(({ db }) => db.query("calendarSubscriptions").collect())).toEqual([]);
  });

  it("requires the server secret for every operation and rejects forged tokens before publishing anything", async () => {
    const t = await fixture();
    await expect(t.mutation(api.calendarFeeds.readFeed, { secret: "wrong", tokenHash, signingKeyId, calendar: "habitat" })).rejects.toThrow("Unauthorized");
    await expect(t.mutation(api.calendarFeeds.upsertSubscription, { secret: "wrong", userId, nonce, tokenHash, signingKeyId, rotate: true })).rejects.toThrow("Unauthorized");
    await expect(t.mutation(api.calendarFeeds.revokeSubscription, { secret: "wrong", userId })).rejects.toThrow("Unauthorized");
    expect(await t.mutation(api.calendarFeeds.readFeed, { secret, tokenHash: "c".repeat(64), signingKeyId, calendar: "habitat" })).toBeNull();
    expect(await t.run(({ db }) => db.query("calendarFeedEvents").collect())).toEqual([]);
    await expect(t.mutation(api.calendarFeeds.upsertSubscription, { secret, userId: "missing", nonce, tokenHash, signingKeyId, rotate: false })).rejects.toThrow("Unauthorized");
  });

  it("invalidates old links on signing-key changes and recovers with fresh working links", async () => {
    const t = await fixture();
    const read = { secret, tokenHash, signingKeyId, calendar: "habitat" as const };
    expect(await t.mutation(api.calendarFeeds.readFeed, read)).not.toBeNull();
    const nextKeyId = "e".repeat(64);
    expect(await t.mutation(api.calendarFeeds.readFeed, { ...read, signingKeyId: nextKeyId })).toBeNull();
    const replacement = { secret, userId, nonce: "r".repeat(43), tokenHash: "b".repeat(64), signingKeyId: nextKeyId, rotate: false };
    expect(await t.mutation(api.calendarFeeds.upsertSubscription, replacement)).toBe(replacement.nonce);
    expect(await t.mutation(api.calendarFeeds.readFeed, { ...read, signingKeyId: nextKeyId })).toBeNull();
    expect(await t.mutation(api.calendarFeeds.readFeed, { ...read, tokenHash: replacement.tokenHash, signingKeyId: nextKeyId })).not.toBeNull();
    expect(await t.run(({ db }) => db.query("calendarSubscriptions").collect())).toHaveLength(1);
  });
});
