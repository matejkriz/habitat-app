import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExcuseStatus, type Excuse } from "./types";

const mocks = vi.hoisted(() => ({
  getExcuse: vi.fn(),
  updateExcuse: vi.fn(),
  bulkUpdateAttendance: vi.fn(),
  createAuditLog: vi.fn(),
  getSchoolDaysInRange: vi.fn(),
  getParentLink: vi.fn(),
}));

vi.mock("./db", () => ({
  db: {
    excuses: {
      get: mocks.getExcuse,
      update: mocks.updateExcuse,
    },
    attendance: {
      bulkUpdate: mocks.bulkUpdateAttendance,
    },
    auditLogs: {
      create: mocks.createAuditLog,
    },
    parentLinks: {
      get: mocks.getParentLink,
    },
  },
}));

vi.mock("./school-days", () => ({
  getSchoolDaysInRange: mocks.getSchoolDaysInRange,
}));

vi.mock("./slack", () => ({
  sendExcuseNotification: vi.fn(),
}));

import { canManageExcuse, updateExcuse } from "./excuse";

const currentExcuse: Excuse = {
  id: "excuse-1",
  childId: "child-1",
  fromDate: new Date("2024-01-01T00:00:00"),
  toDate: new Date("2024-01-03T00:00:00"),
  reason: "Nemoc",
  submittedById: "parent-1",
  submittedAt: new Date("2023-12-30T08:00:00"),
  autoApproved: true,
  createdAt: new Date("2023-12-30T08:00:00"),
  updatedAt: new Date("2023-12-30T08:00:00"),
};

describe("updateExcuse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getExcuse.mockResolvedValue(currentExcuse);
    mocks.updateExcuse.mockResolvedValue({
      ...currentExcuse,
      fromDate: new Date("2024-01-02T00:00:00"),
      toDate: new Date("2024-01-04T00:00:00"),
    });
    mocks.getSchoolDaysInRange.mockResolvedValue([
      new Date("2024-01-02T00:00:00"),
      new Date("2024-01-03T00:00:00"),
      new Date("2024-01-04T00:00:00"),
    ]);
  });

  it("detaches attendance from the old range before attaching the new range", async () => {
    await updateExcuse(
      currentExcuse.id,
      {
        fromDate: new Date("2024-01-02"),
        toDate: new Date("2024-01-04"),
      },
      "director-1",
    );

    expect(mocks.bulkUpdateAttendance).toHaveBeenNthCalledWith(1, {
      where: { excuseId: currentExcuse.id },
      data: {
        excuseId: null,
        excuseStatus: ExcuseStatus.UNEXCUSED,
      },
    });

    expect(mocks.bulkUpdateAttendance).toHaveBeenNthCalledWith(2, {
      where: {
        childId: currentExcuse.childId,
        date: new Date(2024, 0, 2),
        presence: "ABSENT",
        excuseId: null,
      },
      data: {
        excuseId: currentExcuse.id,
        excuseStatus: ExcuseStatus.EXCUSED,
      },
    });
  });
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
