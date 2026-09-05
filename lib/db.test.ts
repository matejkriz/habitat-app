import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../convex/_generated/api";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  mutation: vi.fn(),
  measureServerOperation: vi.fn(
    async <Result>(
      _operation: string,
      operation: () => Promise<Result>,
    ): Promise<Result> => await operation(),
  ),
}));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    query = mocks.query;
    mutation = mocks.mutation;
  },
}));
vi.mock("./server-timing", () => ({
  measureServerOperation: mocks.measureServerOperation,
}));

import { db } from "./db";

const legacyExcuse = {
  _id: "convex-excuse-1",
  _creationTime: 1,
  id: "excuse-1",
  childId: "child-1",
  fromDate: new Date(2026, 7, 20).getTime(),
  toDate: new Date(2026, 7, 20).getTime(),
  reason: null,
  submittedById: "parent-1",
  submittedAt: new Date(2026, 7, 20, 10).getTime(),
  autoApproved: true,
  createdAt: new Date(2026, 7, 20, 10).getTime(),
  updatedAt: new Date(2026, 7, 20, 12).getTime(),
};

describe("legacy excuse rollout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CONVEX_URL", "https://example.convex.cloud");
    vi.stubEnv("PUSH_INTERNAL_SECRET", "test-server-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("preserves a legacy director approval when the new field is absent", async () => {
    mocks.query
      .mockResolvedValueOnce([legacyExcuse])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const [excuse] = await db.excuses.list();

    expect(excuse.lateApprovedAt).toEqual(new Date(legacyExcuse.updatedAt));
    expect(excuse.cancelLunch).toBe(true);
  });

  it("preserves an explicit choice to keep lunch", async () => {
    mocks.query
      .mockResolvedValueOnce([{ ...legacyExcuse, cancelLunch: false }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const [excuse] = await db.excuses.list();

    expect(excuse.cancelLunch).toBe(false);
  });

  it("honors an explicit revoked approval instead of falling back", async () => {
    mocks.query
      .mockResolvedValueOnce([{ ...legacyExcuse, lateApprovedAt: null }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const [excuse] = await db.excuses.list();

    expect(excuse.lateApprovedAt).toBeNull();
  });
});

describe("legacy child rollout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CONVEX_URL", "https://example.convex.cloud");
    vi.stubEnv("PUSH_INTERNAL_SECRET", "test-server-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps lunches enabled when the new field is absent", async () => {
    mocks.query.mockResolvedValueOnce([
      {
        id: "child-1",
        firstName: "Anna",
        lastName: "Malá",
        gender: "FEMALE",
        active: true,
        createdAt: 1,
        updatedAt: 1,
      },
    ]);

    const [child] = await db.children.list();

    expect(child.doesNotTakeLunch).toBe(false);
  });
});

describe("indexed startup adapter queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CONVEX_URL", "https://example.convex.cloud");
    vi.stubEnv("PUSH_INTERNAL_SECRET", "test-server-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("gets a user without listing the users table", async () => {
    mocks.query.mockResolvedValue({
      id: "user-1",
      workosId: "workos-1",
      name: "Rodič",
      email: "parent@example.test",
      image: null,
      role: "PARENT",
      createdAt: 1,
      updatedAt: 2,
    });

    await expect(
      db.users.get({ where: { workosId: "workos-1" } }),
    ).resolves.toMatchObject({ id: "user-1", workosId: "workos-1" });
    expect(mocks.query).toHaveBeenCalledOnce();
    expect(mocks.query).toHaveBeenCalledWith(api.db.findUser, {
      secret: "test-server-secret",
      workosId: "workos-1",
    });
    expect(mocks.measureServerOperation.mock.calls[0]?.[0]).toBe(
      "convex.query.db:findUser",
    );
  });

  it("loads a parent's child links in one Convex request", async () => {
    mocks.query.mockResolvedValue([
      {
        id: "link-1",
        parentId: "parent-1",
        childId: "child-1",
        createdAt: 1,
        child: {
          id: "child-1",
          firstName: "Anna",
          lastName: "Malá",
          active: true,
          createdAt: 1,
          updatedAt: 2,
        },
      },
    ]);

    const links = await db.parentLinks.list({
      where: { parentId: "parent-1" },
      include: { child: true },
    });

    expect(links[0]).toMatchObject({
      id: "link-1",
      createdAt: new Date(1),
      child: { id: "child-1", doesNotTakeLunch: false },
    });
    expect(mocks.query).toHaveBeenCalledOnce();
    expect(mocks.query).toHaveBeenCalledWith(api.db.listParentChildren, {
      secret: "test-server-secret",
      parentId: "parent-1",
    });
  });

  it("checks a parent-child link through the composite index", async () => {
    mocks.query.mockResolvedValue({
      id: "link-1",
      parentId: "parent-1",
      childId: "child-1",
      createdAt: 1,
    });

    await expect(
      db.parentLinks.get({
        where: {
          parentId_childId: { parentId: "parent-1", childId: "child-1" },
        },
      }),
    ).resolves.toMatchObject({ id: "link-1", createdAt: new Date(1) });
    expect(mocks.query).toHaveBeenCalledOnce();
    expect(mocks.query).toHaveBeenCalledWith(api.db.getParentChild, {
      secret: "test-server-secret",
      parentId: "parent-1",
      childId: "child-1",
    });
  });

  it("loads active children without unrelated table scans", async () => {
    mocks.query.mockResolvedValue([
      {
        id: "child-1",
        firstName: "Anna",
        lastName: "Malá",
        active: true,
        createdAt: 1,
        updatedAt: 2,
      },
    ]);

    const children = await db.children.list({ where: { active: true } });

    expect(children[0]).toMatchObject({
      id: "child-1",
      doesNotTakeLunch: false,
    });
    expect(mocks.query).toHaveBeenCalledOnce();
    expect(mocks.query).toHaveBeenCalledWith(api.db.listChildren, {
      secret: "test-server-secret",
      active: true,
    });
  });

  it("counts active children through the same indexed query", async () => {
    mocks.query.mockResolvedValue([
      {
        id: "child-1",
        firstName: "Anna",
        lastName: "Malá",
        active: true,
        createdAt: 1,
        updatedAt: 2,
      },
    ]);

    await expect(db.children.count({ where: { active: true } })).resolves.toBe(1);
    expect(mocks.query).toHaveBeenCalledOnce();
    expect(mocks.query).toHaveBeenCalledWith(api.db.listChildren, {
      secret: "test-server-secret",
      active: true,
    });
  });

  it("times Convex mutations by function name", async () => {
    mocks.mutation.mockResolvedValue("convex-document-id");

    await db.children.create({
      data: { firstName: "Anna", lastName: "Malá", active: true },
    });

    expect(mocks.measureServerOperation.mock.calls[0]?.[0]).toBe(
      "convex.mutation.db:insert",
    );
  });
});
