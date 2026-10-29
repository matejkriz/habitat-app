import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const login = {
  secret: "test-server-secret",
  workosUserId: "user_parent",
  email: "parent@example.test",
  loginId: "session-1",
};

type SetupOptions = {
  includeParent?: boolean;
  role?: "PARENT" | "TEACHER" | "DIRECTOR";
  prefilled?: boolean;
  child?: "active" | "inactive" | "missing";
};

async function setup(options: SetupOptions = {}) {
  const t = convexTest(schema, modules);
  const subscriptions = await t.run(async ({ db }) => {
    const now = Date.now();
    if (options.includeParent !== false) {
      await db.insert("users", {
        id: "parent-1",
        workosId: options.prefilled ? "seed:parent" : login.workosUserId,
        email: login.email,
        role: options.role ?? "PARENT",
        createdAt: now,
        updatedAt: now,
      });
    }

    if (options.child) {
      await db.insert("parentChildren", {
        id: "link-1",
        parentId: "parent-1",
        childId: "child-1",
        createdAt: now,
      });
      if (options.child !== "missing") {
        await db.insert("children", {
          id: "child-1",
          firstName: "Anna",
          lastName: "Testovací",
          active: options.child === "active",
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    await db.insert("users", {
      id: "director-1",
      role: "DIRECTOR",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert("users", {
      id: "teacher-1",
      role: "TEACHER",
      createdAt: now,
      updatedAt: now,
    });
    const eligible = await db.insert("pushSubscriptions", {
      userId: "director-1",
      endpoint: "https://push.example.test/director",
      p256dh: "test-key",
      auth: "test-auth",
      topics: ["DIRECTOR_EXCUSE_CREATED"],
      createdAt: now,
      updatedAt: now,
    });
    for (const [userId, topic] of [
      ["director-1", "OTHER_TOPIC"],
      ["teacher-1", "DIRECTOR_EXCUSE_CREATED"],
      ["deleted-user", "DIRECTOR_EXCUSE_CREATED"],
    ]) {
      await db.insert("pushSubscriptions", {
        userId,
        endpoint: `https://push.example.test/${userId}/${topic}`,
        p256dh: "test-key",
        auth: "test-auth",
        topics: [topic],
        createdAt: now,
        updatedAt: now,
      });
    }
    return { eligible };
  });
  return { t, subscriptions };
}

describe("unassigned parent login notifications", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("PUSH_INTERNAL_SECRET", login.secret);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("notifies existing director subscriptions on an unknown first sign-in", async () => {
    const { t, subscriptions } = await setup({ includeParent: false });

    const eventId = await t.mutation(api.pushNotifications.enqueueUnassignedParentLogin, login);

    await t.run(async ({ db }) => {
      expect(await db.get(eventId!)).toMatchObject({
        dedupeKey: "UNASSIGNED_PARENT_LOGIN:session-1",
        type: "UNASSIGNED_PARENT_LOGIN",
        title: "Přihlášení bez přiřazeného dítěte",
        body: expect.stringContaining(login.email),
        url: "/reditel/deti",
      });
      const deliveries = await db.query("notificationDeliveries").collect();
      expect(deliveries).toEqual([
        expect.objectContaining({
          eventId,
          subscriptionId: subscriptions.eligible,
          status: "PENDING",
          attemptCount: 0,
        }),
      ]);
    });
    const claimed = await t.mutation(internal.pushNotifications.claimDelivery, {
      deliveryId: await t.run(async ({ db }) =>
        (await db.query("notificationDeliveries").first())!._id,
      ),
    });
    expect(claimed?.event.body).toContain(login.email);
    expect(claimed?.subscription.endpoint).toBe("https://push.example.test/director");
  });

  it("notifies for an existing parent without child assignments", async () => {
    const { t } = await setup();
    expect(await t.mutation(api.pushNotifications.enqueueUnassignedParentLogin, login)).not.toBeNull();
  });

  it("finds a prefilled parent by email before the WorkOS account is linked", async () => {
    const { t } = await setup({ prefilled: true, child: "active" });
    expect(await t.mutation(api.pushNotifications.enqueueUnassignedParentLogin, login)).toBeNull();
  });

  it.each(["PARENT@EXAMPLE.TEST", " parent@example.test ", "  Parent@Example.Test  "])(
    "does not alert for an invited parent whose first callback email is %j", async email => {
      const { t } = await setup({ prefilled: true, child: "active" });
      await t.run(async ({ db }) => {
        const parent = (await db.query("users").withIndex("by_app_id", q => q.eq("id", "parent-1")).unique())!;
        await db.patch(parent._id, { workosId: undefined });
      });

      expect(await t.mutation(api.pushNotifications.enqueueUnassignedParentLogin, { ...login, email })).toBeNull();

      await t.run(async ({ db }) => {
        expect(await db.query("notificationEvents").collect()).toHaveLength(0);
        expect(await db.query("notificationDeliveries").collect()).toHaveLength(0);
        const parent = (await db.query("users").withIndex("by_app_id", q => q.eq("id", "parent-1")).unique())!;
        expect(parent.email).toBe(login.email);
        expect(parent.workosId).toBeUndefined();
      });
    },
  );

  it("matches a prefilled parent's legacy email casing without changing identity fields", async () => {
    const { t } = await setup({ prefilled: true, child: "active" });
    await t.run(async ({ db }) => {
      const parent = (await db.query("users").withIndex("by_app_id", q => q.eq("id", "parent-1")).unique())!;
      await db.patch(parent._id, { email: "Parent@Example.Test" });
    });

    expect(await t.mutation(api.pushNotifications.enqueueUnassignedParentLogin, login)).toBeNull();

    await t.run(async ({ db }) => {
      const parent = (await db.query("users").withIndex("by_app_id", q => q.eq("id", "parent-1")).unique())!;
      expect(parent.email).toBe("Parent@Example.Test");
      expect(parent.workosId).toBe("seed:parent");
    });
  });

  it("rejects an ambiguous email match without creating a false alert", async () => {
    const { t } = await setup({ prefilled: true, child: "active" });
    await t.run(async ({ db }) => {
      await db.insert("users", {
        id: "duplicate-parent", email: "Parent@Example.Test", role: "PARENT",
        createdAt: Date.now(), updatedAt: Date.now(),
      });
    });

    await expect(t.mutation(api.pushNotifications.enqueueUnassignedParentLogin, login)).rejects.toThrow("více účtů");

    await t.run(async ({ db }) => {
      expect(await db.query("notificationEvents").collect()).toHaveLength(0);
      expect(await db.query("notificationDeliveries").collect()).toHaveLength(0);
    });
  });

  it.each(["active", "inactive"] as const)("keeps an %s child as an assignment", async (child) => {
    const { t } = await setup({ child });
    expect(await t.mutation(api.pushNotifications.enqueueUnassignedParentLogin, login)).toBeNull();
    await t.run(async ({ db }) => {
      expect(await db.query("notificationEvents").collect()).toHaveLength(0);
      expect(await db.query("notificationDeliveries").collect()).toHaveLength(0);
    });
  });

  it("does not treat a dangling link as an assigned child", async () => {
    const { t } = await setup({ child: "missing" });
    expect(await t.mutation(api.pushNotifications.enqueueUnassignedParentLogin, login)).not.toBeNull();
  });

  it.each(["TEACHER", "DIRECTOR"] as const)("does not notify for an existing %s", async (role) => {
    const { t } = await setup({ role });
    expect(await t.mutation(api.pushNotifications.enqueueUnassignedParentLogin, login)).toBeNull();
  });

  it.each(["TEACHER", "DIRECTOR"] as const)("does not notify for a prefilled %s", async (role) => {
    const { t } = await setup({ role, prefilled: true });
    expect(await t.mutation(api.pushNotifications.enqueueUnassignedParentLogin, login)).toBeNull();
  });

  it("prefers the linked WorkOS identity to a different account with the login email", async () => {
    const { t } = await setup({ role: "TEACHER" });
    await t.run(async ({ db }) => {
      const user = (await db.query("users").withIndex("by_app_id", (q) => q.eq("id", "parent-1")).unique())!;
      await db.patch(user._id, { email: "old@example.test" });
      await db.insert("users", {
        id: "different-parent",
        email: login.email,
        role: "PARENT",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
    expect(await t.mutation(api.pushNotifications.enqueueUnassignedParentLogin, login)).toBeNull();
  });

  it("deduplicates one login while notifying again for a new login", async () => {
    const { t } = await setup();
    const first = await t.mutation(api.pushNotifications.enqueueUnassignedParentLogin, login);
    expect(await t.mutation(api.pushNotifications.enqueueUnassignedParentLogin, login)).toBe(first);
    const second = await t.mutation(api.pushNotifications.enqueueUnassignedParentLogin, {
      ...login,
      loginId: "session-2",
    });
    expect(second).not.toBe(first);
    await t.run(async ({ db }) => {
      expect(await db.query("notificationEvents").collect()).toHaveLength(2);
      expect(await db.query("notificationDeliveries").collect()).toHaveLength(2);
    });
  });

  it("requires the server secret", async () => {
    const { t } = await setup();
    await expect(t.mutation(api.pushNotifications.enqueueUnassignedParentLogin, {
      ...login,
      secret: "wrong-secret",
    })).rejects.toThrow("Unauthorized");
    await t.run(async ({ db }) => {
      expect(await db.query("notificationEvents").collect()).toHaveLength(0);
    });
  });

  it("preserves the existing excuse event and delivery behavior", async () => {
    const { t, subscriptions } = await setup({ child: "active" });
    const now = Date.now();
    await t.run(async ({ db }) => {
      await db.insert("excuses", {
        id: "excuse-1",
        childId: "child-1",
        fromDate: now,
        toDate: now,
        reason: "Nemoc",
        submittedById: "parent-1",
        submittedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    });
    const request = { secret: login.secret, excuseId: "excuse-1" };
    const eventId = await t.mutation(api.pushNotifications.enqueueExcuse, request);
    expect(await t.mutation(api.pushNotifications.enqueueExcuse, request)).toBe(eventId);
    await t.run(async ({ db }) => {
      expect(await db.get(eventId!)).toMatchObject({
        type: "EXCUSE_CREATED",
        title: "Nová omluvenka",
        body: expect.stringContaining("Anna Testovací"),
        url: "/reditel/omluvenky",
      });
      const deliveries = await db.query("notificationDeliveries").collect();
      expect(deliveries).toHaveLength(1);
      expect(deliveries[0].subscriptionId).toBe(subscriptions.eligible);
    });
  });
});
