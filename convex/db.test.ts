import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("database excuse creation", () => {
  beforeEach(() => vi.stubEnv("PUSH_INTERNAL_SECRET", "test-server-secret"));
  afterEach(() => vi.unstubAllEnvs());

  it("atomically approves an excuse when the child does not take lunches", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    await t.run(async ({ db }) => {
      await db.insert("children", {
        id: "child-1",
        firstName: "Anna",
        lastName: "Malá",
        gender: "FEMALE",
        doesNotTakeLunch: true,
        active: true,
        createdAt: now,
        updatedAt: now,
      });
    });

    const excuse = await t.mutation(api.db.createExcuse, {
      secret: "test-server-secret",
      value: {
        id: "excuse-1",
        childId: "child-1",
        fromDate: now,
        toDate: now,
        reason: null,
        cancelLunch: false,
        submittedById: "parent-1",
        submittedAt: now,
        lateApprovedAt: null,
        lateApprovedById: null,
        createdAt: now,
        updatedAt: now,
      },
    });

    expect(excuse.lateApprovedAt).toEqual(expect.any(Number));
    expect(excuse.cancelLunch).toBe(true);
    await t.run(async ({ db }) => {
      const [stored] = await db.query("excuses").collect();
      expect(stored.lateApprovedAt).toBe(excuse.lateApprovedAt);
      expect(stored.lateApprovedById).toBeNull();
    });
  });

  it("atomically approves an excuse that keeps the lunch", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    await t.run(async ({ db }) => {
      await db.insert("children", {
        id: "child-1",
        firstName: "Anna",
        lastName: "Malá",
        gender: "FEMALE",
        doesNotTakeLunch: false,
        active: true,
        createdAt: now,
        updatedAt: now,
      });
    });

    const excuse = await t.mutation(api.db.createExcuse, {
      secret: "test-server-secret",
      value: {
        id: "excuse-1",
        childId: "child-1",
        fromDate: now,
        toDate: now,
        reason: null,
        cancelLunch: false,
        submittedById: "parent-1",
        submittedAt: now,
        lateApprovedAt: null,
        lateApprovedById: null,
        createdAt: now,
        updatedAt: now,
      },
    });

    expect(excuse.cancelLunch).toBe(false);
    expect(excuse.lateApprovedAt).toEqual(expect.any(Number));
    expect(excuse.lateApprovedById).toBeNull();
  });

  it("accepts legacy partial-day excuses after the feature rollback", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    const storedDayPart = await t.run(async ({ db }) => {
      const excuseId = await db.insert(
        "excuses",
        {
          id: "legacy-partial-day-excuse",
          childId: "seed-child-tobias",
          fromDate: now,
          toDate: now,
          reason: null,
          dayPart: "MORNING",
          cancelLunch: true,
          submittedById: "seed-user-parent-vera",
          submittedAt: now,
          lateApprovedAt: null,
          lateApprovedById: null,
          createdAt: now,
          updatedAt: now,
        },
      );
      const stored = await db.get(excuseId);

      return stored?.dayPart;
    });

    expect(storedDayPart).toBe("MORNING");
  });
});

describe("indexed startup queries", () => {
  beforeEach(() => vi.stubEnv("PUSH_INTERNAL_SECRET", "test-server-secret"));
  afterEach(() => vi.unstubAllEnvs());

  it("finds a user through each supported identity", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    await t.run(async ({ db }) => {
      await db.insert("users", {
        id: "user-1",
        workosId: "workos-1",
        name: "Rodič",
        email: "parent@example.test",
        image: null,
        role: "PARENT",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert("users", {
        id: "decoy",
        workosId: "workos-decoy",
        name: "Jiný uživatel",
        email: "decoy@example.test",
        image: null,
        role: "DIRECTOR",
        createdAt: now,
        updatedAt: now,
      });
    });

    const byId = await t.query(api.db.findUser, {
      secret: "test-server-secret",
      id: "user-1",
    });
    const byWorkosId = await t.query(api.db.findUser, {
      secret: "test-server-secret",
      workosId: "workos-1",
    });
    const byEmail = await t.query(api.db.findUser, {
      secret: "test-server-secret",
      email: "parent@example.test",
    });

    expect(byId?.id).toBe("user-1");
    expect(byWorkosId?.id).toBe("user-1");
    expect(byEmail?.id).toBe("user-1");
  });

  it("returns only one parent's linked children", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    await t.run(async ({ db }) => {
      for (const [id, firstName] of [
        ["child-1", "Anna"],
        ["child-2", "Berta"],
      ] as const) {
        await db.insert("children", {
          id,
          firstName,
          lastName: "Malá",
          active: true,
          createdAt: now,
          updatedAt: now,
        });
      }
      await db.insert("parentChildren", {
        id: "link-1",
        parentId: "parent-1",
        childId: "child-1",
        createdAt: now,
      });
      await db.insert("parentChildren", {
        id: "link-2",
        parentId: "parent-2",
        childId: "child-2",
        createdAt: now,
      });
    });

    const links = await t.query(api.db.listParentChildren, {
      secret: "test-server-secret",
      parentId: "parent-1",
    });
    const link = await t.query(api.db.getParentChild, {
      secret: "test-server-secret",
      parentId: "parent-1",
      childId: "child-1",
    });

    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      id: "link-1",
      child: { id: "child-1", firstName: "Anna" },
    });
    expect(link?.id).toBe("link-1");
  });

  it("filters children by active state", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    await t.run(async ({ db }) => {
      await db.insert("children", {
        id: "active-child",
        firstName: "Anna",
        lastName: "Malá",
        active: true,
        createdAt: now,
        updatedAt: now,
      });
      await db.insert("children", {
        id: "inactive-child",
        firstName: "Berta",
        lastName: "Malá",
        active: false,
        createdAt: now,
        updatedAt: now,
      });
    });

    const children = await t.query(api.db.listChildren, {
      secret: "test-server-secret",
      active: true,
    });

    expect(children.map((child) => child.id)).toEqual(["active-child"]);
  });
});
