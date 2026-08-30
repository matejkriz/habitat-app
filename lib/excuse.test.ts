import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Excuse } from "./types";

const mocks = vi.hoisted(() => ({
  getExcuse: vi.fn(),
  listOverlappingExcuses: vi.fn(),
  updateExcuse: vi.fn(),
  createAuditLog: vi.fn(),
  getParentLink: vi.fn(),
}));

vi.mock("./db", () => ({
  db: {
    excuses: {
      get: mocks.getExcuse,
      listOverlapping: mocks.listOverlappingExcuses,
      update: mocks.updateExcuse,
    },
    auditLogs: {
      create: mocks.createAuditLog,
    },
    parentLinks: {
      get: mocks.getParentLink,
    },
  },
}));

vi.mock("./slack", () => ({
  sendExcuseNotification: vi.fn(),
}));

import {
  canManageExcuse,
  canManageExcuses,
  getExcusesOverlapping,
  updateExcuse,
} from "./excuse";

const currentExcuse: Excuse = {
  id: "excuse-1",
  childId: "child-1",
  fromDate: new Date("2024-01-01T00:00:00"),
  toDate: new Date("2024-01-03T00:00:00"),
  reason: "Nemoc",
  submittedById: "parent-1",
  submittedAt: new Date("2023-12-30T08:00:00"),
  lateApprovedAt: null,
  lateApprovedById: null,
  createdAt: new Date("2023-12-30T08:00:00"),
  updatedAt: new Date("2023-12-30T08:00:00"),
};

describe("getExcusesOverlapping", () => {
  it("uses the indexed overlap read instead of listing the whole table", async () => {
    mocks.listOverlappingExcuses.mockResolvedValue([currentExcuse]);
    const from = new Date(2024, 0, 2);
    const to = new Date(2024, 0, 3);

    await expect(
      getExcusesOverlapping({ childId: "child-1", from, to }),
    ).resolves.toEqual([currentExcuse]);
    expect(mocks.listOverlappingExcuses).toHaveBeenCalledWith({
      childId: "child-1",
      from,
      to,
    });
  });
});

describe("updateExcuse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getExcuse.mockResolvedValue(currentExcuse);
    mocks.updateExcuse.mockImplementation((args: { data: unknown }) =>
      Promise.resolve({ ...currentExcuse, ...(args.data as object) }),
    );
  });

  it("narrows the range without touching attendance", async () => {
    await updateExcuse(
      currentExcuse.id,
      {
        fromDate: new Date(2024, 0, 2),
        toDate: new Date(2024, 0, 3),
      },
      "director-1",
    );

    expect(mocks.updateExcuse).toHaveBeenCalledWith({
      where: { id: currentExcuse.id },
      data: {
        fromDate: new Date(2024, 0, 2),
        toDate: new Date(2024, 0, 3),
        reason: currentExcuse.reason,
      },
    });
  });

  it.each([
    ["an earlier start", new Date(2023, 11, 31), new Date(2024, 0, 3)],
    ["a later end", new Date(2024, 0, 1), new Date(2024, 0, 4)],
  ])(
    "refuses to grow the range by %s, which would launder the submission time",
    async (_label, fromDate, toDate) => {
      await expect(
        updateExcuse(currentExcuse.id, { fromDate, toDate }, "parent-1"),
      ).rejects.toThrow("Rozsah omluvenky nelze rozšířit");

      expect(mocks.updateExcuse).not.toHaveBeenCalled();
    },
  );
});

describe("canManageExcuse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows a director to manage any child's excuse", async () => {
    await expect(
      canManageExcuse({ id: "director-1", role: "DIRECTOR" }, "child-1"),
    ).resolves.toBe(true);
    expect(mocks.getParentLink).not.toHaveBeenCalled();
  });

  it("allows a parent only when the child belongs to them", async () => {
    mocks.getParentLink
      .mockResolvedValueOnce({ id: "link-1" })
      .mockResolvedValueOnce(null);

    await expect(
      canManageExcuse({ id: "parent-1", role: "PARENT" }, "child-1"),
    ).resolves.toBe(true);
    await expect(
      canManageExcuse({ id: "parent-1", role: "PARENT" }, "child-2"),
    ).resolves.toBe(false);
  });

  it("does not allow teachers to manage excuses", async () => {
    await expect(
      canManageExcuse({ id: "teacher-1", role: "TEACHER" }, "child-1"),
    ).resolves.toBe(false);
  });
});

describe("canManageExcuses", () => {
  it("requires access to every selected child", async () => {
    mocks.getParentLink
      .mockResolvedValueOnce({ id: "link-1" })
      .mockResolvedValueOnce(null);

    await expect(
      canManageExcuses(
        { id: "parent-1", role: "PARENT" },
        ["child-1", "child-2"],
      ),
    ).resolves.toBe(false);
  });
});
