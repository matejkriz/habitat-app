import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  mutation: vi.fn(),
}));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    query = mocks.query;
    mutation = mocks.mutation;
  },
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
    process.env.CONVEX_URL = "https://example.convex.cloud";
  });

  it("preserves a legacy director approval when the new field is absent", async () => {
    mocks.query
      .mockResolvedValueOnce([legacyExcuse])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const [excuse] = await db.excuses.list();

    expect(excuse.lateApprovedAt).toEqual(new Date(legacyExcuse.updatedAt));
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
