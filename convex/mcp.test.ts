import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const request = {
  secret: "test-server-secret",
  workosUserId: "user_123",
  requestId: "123e4567-e89b-42d3-a456-426614174000",
  childIds: ["child-1"],
  fromDate: Date.UTC(2026, 8, 2),
  toDate: Date.UTC(2026, 8, 3),
  reason: "Nemoc",
};

describe("MCP parent excuse mutation", () => {
  beforeEach(() => vi.stubEnv("PUSH_INTERNAL_SECRET", "test-server-secret"));
  afterEach(() => vi.unstubAllEnvs());

  const seed = async (linkedChildIds: ReadonlyArray<string>) => {
    const t = convexTest(schema, modules);
    await t.run(async ({ db }) => {
      const now = Date.now();
      await db.insert("users", {
        id: "parent-1",
        workosId: "user_123",
        role: "PARENT",
        createdAt: now,
        updatedAt: now,
      });
      for (const childId of ["child-1", "child-2"]) {
        await db.insert("children", {
          id: childId,
          firstName: childId === "child-1" ? "Anna" : "Berta",
          lastName: "Testovací",
          gender: "FEMALE",
          active: true,
          createdAt: now,
          updatedAt: now,
        });
      }
      for (const childId of linkedChildIds) {
        await db.insert("parentChildren", {
          id: `link-${childId}`,
          parentId: "parent-1",
          childId,
          createdAt: now,
        });
      }
    });
    return t;
  };

  it("creates the excuse, audit, and idempotency record once", async () => {
    const t = await seed(["child-1"]);
    const first = await t.mutation(api.mcp.createParentExcuses, request);
    const replay = await t.mutation(api.mcp.createParentExcuses, request);

    expect(first.replayed).toBe(false);
    expect(replay).toEqual({ ...first, replayed: true });
    await t.run(async ({ db }) => {
      expect(await db.query("excuses").collect()).toHaveLength(1);
      expect(await db.query("auditLogs").collect()).toHaveLength(1);
      expect(await db.query("mcpExcuseRequests").collect()).toHaveLength(1);
    });
  });

  it("creates nothing when any selected child is not linked to the parent", async () => {
    const t = await seed(["child-1"]);

    await expect(
      t.mutation(api.mcp.createParentExcuses, {
        ...request,
        childIds: ["child-1", "child-2"],
      }),
    ).rejects.toThrow("MCP child access denied");
    await t.run(async ({ db }) => {
      expect(await db.query("excuses").collect()).toHaveLength(0);
      expect(await db.query("auditLogs").collect()).toHaveLength(0);
      expect(await db.query("mcpExcuseRequests").collect()).toHaveLength(0);
    });
  });

  it("rejects callers that are not an existing parent", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.mcp.createParentExcuses, request)).rejects.toThrow(
      "Unauthorized MCP parent",
    );
  });
});
