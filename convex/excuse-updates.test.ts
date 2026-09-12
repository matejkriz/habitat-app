import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const secret = "test-server-secret";
const now = new Date("2026-09-08T08:00:00Z").getTime();

async function setup() {
  const t = convexTest(schema, modules);
  await t.run(async ({ db }) => {
    await db.insert("children", {
      id: "child-1", firstName: "Anna", lastName: "Malá", active: true,
      createdAt: now, updatedAt: now,
    });
    await db.insert("excuses", {
      id: "excuse-1", childId: "child-1", fromDate: now, toDate: now + 86400000,
      reason: "Nemoc", submittedById: "parent-1", submittedAt: now,
      createdAt: now, updatedAt: now,
    });
    for (const role of ["DIRECTOR", "PARENT"] as const) {
      await db.insert("users", { id: role, role, createdAt: now, updatedAt: now });
      await db.insert("pushSubscriptions", {
        userId: role, endpoint: `https://push.test/${role}`, p256dh: "key", auth: "auth",
        topics: ["DIRECTOR_EXCUSE_CREATED"], createdAt: now, updatedAt: now,
      });
    }
  });
  return t;
}

describe("excuse edit push notifications", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.stubEnv("PUSH_INTERNAL_SECRET", secret);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("atomically creates a separate delivery for each edit, even within one millisecond", async () => {
    const t = await setup();
    await t.mutation(api.pushNotifications.enqueueExcuse, { secret, excuseId: "excuse-1" });
    for (const reason of ["Kontrola", "Uzdravení", "Nemoc"]) {
      await t.mutation(api.db.patchById, {
        secret, table: "excuses", id: "excuse-1", patch: { reason, updatedAt: now },
      });
    }
    await t.run(async ({ db }) => {
      const events = await db.query("notificationEvents").collect();
      expect(events).toHaveLength(4);
      expect(new Set(events.map((event) => event.dedupeKey)).size).toBe(4);
      const edits = events.filter((event) => event.type === "EXCUSE_UPDATED");
      expect(edits.map((event) => event.title)).toEqual(Array(3).fill("Změna omluvenky"));
      expect(edits.map((event) => event.body)).toEqual([
        expect.stringContaining("Kontrola"), expect.stringContaining("Uzdravení"),
        expect.stringContaining("Nemoc"),
      ]);
      const deliveries = await db.query("notificationDeliveries").collect();
      expect(deliveries).toHaveLength(4);
      for (const delivery of deliveries) {
        expect(delivery.status).toBe("PENDING");
        expect((await db.get(delivery.subscriptionId))?.userId).toBe("DIRECTOR");
      }
    });
  });

  it("includes changed dates and day part, even for an old excuse without a creation event", async () => {
    const t = await setup();
    await t.mutation(api.db.patchById, {
      secret, table: "excuses", id: "excuse-1",
      patch: { toDate: now, dayPart: "AFTERNOON", updatedAt: now },
    });
    await t.run(async ({ db }) => {
      const events = await db.query("notificationEvents").collect();
      expect(events).toHaveLength(1);
      expect(events[0].body).toContain("jen odpoledne");
      expect(events[0].body).not.toContain("9. 9.");
    });
  });

  it("does not notify for unchanged values, legacy defaults or approval metadata", async () => {
    const t = await setup();
    await t.mutation(api.db.patchById, {
      secret, table: "excuses", id: "excuse-1",
      patch: { reason: "Nemoc", dayPart: "FULL_DAY", cancelLunch: true,
        updatedAt: now + 1, lateApprovedAt: now, lateApprovedById: "DIRECTOR" },
    });
    expect(await t.run(({ db }) => db.query("notificationEvents").collect())).toEqual([]);
  });
});
