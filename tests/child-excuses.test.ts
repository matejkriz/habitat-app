// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { getFunctionName } from "convex/server";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const transport = vi.hoisted(() => ({ query: vi.fn(), mutation: vi.fn() }));
vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    query = transport.query;
    mutation = transport.mutation;
  },
}));
import { db } from "../lib/db";
import { loadLunchOverview } from "../lib/lunch-overview";

const modules = import.meta.glob("../convex/**/*.ts");
const createTest = () => convexTest(schema, modules);
const secret = "child-excuses-test-secret";
let t: ReturnType<typeof createTest>;

beforeEach(async () => {
  vi.stubEnv("CONVEX_URL", "https://test.convex.cloud");
  vi.stubEnv("PUSH_INTERNAL_SECRET", secret);
  transport.query.mockReset();
  transport.query.mockImplementation((ref, args) => t.query(ref, args));
  t = createTest();
  await t.run(async ({ db }) => {
    for (const id of ["a", "b"]) {
      await db.insert("children", {
        id, firstName: id, lastName: "Test", active: true, createdAt: 1, updatedAt: 1,
      });
      await db.insert("users", {
        id: `parent-${id}`, name: `Parent ${id}`, role: "PARENT", createdAt: 1, updatedAt: 1,
      });
    }
    for (const [id, childId, submittedAt, fromDate] of [
      ["a-old", "a", 10, 100],
      ["b-new", "b", 1000, 100],
      ["a-new-outside", "a", 50, 500],
      ["a-new-match", "a", 40, 200],
      ["a-middle", "a", 30, 100],
      ["a-earlier", "a", 20, 100],
    ] as const) {
      await db.insert("excuses", {
        id, childId, submittedAt, fromDate, toDate: fromDate, reason: "Test",
        submittedById: `parent-${childId}`, createdAt: 1, updatedAt: 1,
      });
    }
  });
});

afterEach(() => vi.unstubAllEnvs());

describe("child-scoped excuse reads", () => {
  it("returns the child's latest rows with one bounded database request and no table downloads", async () => {
    const rows = await db.excuses.list({
      where: { childId: "a" }, orderBy: { submittedAt: "desc" }, take: 2,
    });
    expect(rows.map((row: { id: string }) => row.id)).toEqual(["a-new-outside", "a-new-match"]);
    expect(rows[0].submittedAt).toEqual(new Date(50));
    expect(transport.query).toHaveBeenCalledTimes(1);
    const [reference, args] = transport.query.mock.calls[0];
    expect(getFunctionName(reference)).toBe("db:listChildExcuses");
    expect(args).toMatchObject({ childId: "a", take: 2, order: "desc" });
  });

  it("filters date ranges before limiting and sorts both directions", async () => {
    const descending = await db.excuses.list({
      where: {
        childId: "a", fromDate: { gte: new Date(100), lte: new Date(200) },
        submittedAt: { gte: new Date(20), lte: new Date(40) },
      },
      orderBy: { submittedAt: "desc" }, take: 2,
    });
    expect(descending.map((row: { id: string }) => row.id)).toEqual(["a-new-match", "a-middle"]);
    const ascending = await db.excuses.list({
      where: { childId: "a", submittedAt: { gte: 20, lte: 40 } },
      orderBy: { submittedAt: "asc" }, take: 2,
    });
    expect(ascending.map((row: { id: string }) => row.id)).toEqual(["a-earlier", "a-middle"]);
  });

  it("supports exact date filters and preserves insertion order without an explicit sort", async () => {
    const rows = await db.excuses.list({ where: { childId: "a", fromDate: new Date(100) } });
    expect(rows.map((row: { id: string }) => row.id)).toEqual(["a-old", "a-middle", "a-earlier"]);
    const exactSubmission = await db.excuses.list({ where: { childId: "a", submittedAt: 30 } });
    expect(exactSubmission.map((row: { id: string }) => row.id)).toEqual(["a-middle"]);
  });

  it("loads only requested relations for returned rows and retains field selection", async () => {
    const rows = await db.excuses.list({
      where: { childId: "a" }, orderBy: { submittedAt: "desc" }, take: 2,
      include: {
        child: { select: { id: true, firstName: true } },
        submittedBy: { select: { name: true } },
      },
    });
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row).toMatchObject({ child: { id: "a", firstName: "a" }, submittedBy: { name: "Parent a" } });
      expect(row).not.toHaveProperty("child.lastName");
      expect(row).not.toHaveProperty("submittedBy.role");
    }
    expect(transport.query.mock.calls.map(([ref, args]) => [getFunctionName(ref), args.table, args.id])).toEqual([
      ["db:listChildExcuses", undefined, undefined],
      ["db:getById", "children", "a"],
      ["db:getById", "users", "parent-a"],
    ]);
  });

  it.each(["missing", "a"])("returns no rows or relations for an empty selection of %s", async childId => {
    const rows = await db.excuses.list({
      where: { childId }, take: childId === "a" ? 0 : 10,
      include: { child: true, submittedBy: true },
    });
    expect(rows).toEqual([]);
    expect(transport.query).toHaveBeenCalledTimes(1);
  });

  it("protects the database query with the internal secret", async () => {
    await expect(t.query(api.db.listChildExcuses, { secret: "wrong", childId: "a" })).rejects.toThrow();
  });

  it("rejects invalid limits and handles an empty date interval", async () => {
    for (const take of [-1, 0.5, NaN, Infinity]) {
      await expect(t.query(api.db.listChildExcuses, { secret, childId: "a", take })).rejects.toThrow();
    }
    expect(await t.query(api.db.listChildExcuses, {
      secret, childId: "a", fromDate: { gte: 200, lte: 100 }, order: "desc",
    })).toEqual([]);
  });

  it("loads parent lunch excuses only for linked children through scoped overlap queries", async () => {
    await t.run(({ db }) => db.insert("parentChildren", {
      id: "link-a", parentId: "parent-a", childId: "a", createdAt: 1,
    }));
    const overview = await loadLunchOverview("2026-09", "parent-a");
    expect(overview.children.map(child => child.id)).toEqual(["a"]);
    const excuseQueries = transport.query.mock.calls.filter(([ref]) =>
      getFunctionName(ref) === "db:listExcusesOverlapping");
    expect(excuseQueries).toHaveLength(1);
    expect(excuseQueries[0][1]).toMatchObject({
      childId: "a", from: new Date(2026, 8, 1).getTime(), to: new Date(2026, 9, 0, 23, 59, 59, 999).getTime(),
    });
    expect(transport.query.mock.calls.some(([ref, args]) =>
      getFunctionName(ref) === "db:list" && args.table === "excuses")).toBe(false);
  });

  it("skips all excuse reads for a parent with no linked children", async () => {
    expect((await loadLunchOverview("2026-09", "parent-a")).children).toEqual([]);
    expect(transport.query.mock.calls.some(([ref, args]) =>
      getFunctionName(ref) === "db:listExcusesOverlapping" ||
      (getFunctionName(ref) === "db:list" && args.table === "excuses"))).toBe(false);
  });

  it("keeps the director's school-wide lunch overview", async () => {
    const overview = await loadLunchOverview("2026-09");
    expect(overview.children.map(child => child.id).sort()).toEqual(["a", "b"]);
    const excuseQueries = transport.query.mock.calls.filter(([ref]) =>
      getFunctionName(ref) === "db:listExcusesOverlapping");
    expect(excuseQueries).toHaveLength(1);
    expect(excuseQueries[0][1].childId).toBeUndefined();
  });
});
