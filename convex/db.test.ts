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
        submittedById: "parent-1",
        submittedAt: now,
        lateApprovedAt: null,
        lateApprovedById: null,
        createdAt: now,
        updatedAt: now,
      },
    });

    expect(excuse.lateApprovedAt).toEqual(expect.any(Number));
    await t.run(async ({ db }) => {
      const [stored] = await db.query("excuses").collect();
      expect(stored.lateApprovedAt).toBe(excuse.lateApprovedAt);
      expect(stored.lateApprovedById).toBeNull();
    });
  });
});
