import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createExcuseRecord: vi.fn(),
  createAuditLog: vi.fn(),
  getChild: vi.fn(),
  getUser: vi.fn(),
  enqueueExcuse: vi.fn(),
  sendSlack: vi.fn(),
}));

vi.mock("./db", () => ({
  db: {
    excuses: { create: mocks.createExcuseRecord },
    auditLogs: { create: mocks.createAuditLog },
    children: { get: mocks.getChild },
    users: { get: mocks.getUser },
    notifications: { enqueueExcuse: mocks.enqueueExcuse },
  },
}));

vi.mock("./school-days", () => ({
  getSchoolDaysInRange: vi.fn().mockResolvedValue([]),
}));

vi.mock("./slack", () => ({
  sendExcuseNotification: mocks.sendSlack,
}));

import { createExcuse } from "./excuse";

describe("createExcuse push notification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createExcuseRecord.mockResolvedValue({
      id: "excuse-1",
      childId: "child-1",
      fromDate: new Date(2026, 7, 24),
      toDate: new Date(2026, 7, 25),
      reason: "Nemoc",
      submittedById: "parent-1",
      submittedAt: new Date(),
      lateApprovedAt: null,
      lateApprovedById: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mocks.getChild.mockResolvedValue({ firstName: "Eliška", lastName: "Malá" });
    mocks.getUser.mockResolvedValue({ name: "Petr Malý" });
    mocks.createAuditLog.mockResolvedValue(undefined);
    mocks.enqueueExcuse.mockResolvedValue(undefined);
    mocks.sendSlack.mockResolvedValue(undefined);
  });

  it("durably enqueues the notification before confirming the excuse", async () => {
    await createExcuse(
      "child-1",
      new Date(2026, 7, 24),
      new Date(2026, 7, 25),
      "Nemoc",
      "parent-1",
    );

    expect(mocks.enqueueExcuse).toHaveBeenCalledWith({ excuseId: "excuse-1" });
  });

  it("stores a director approval in the initial insert", async () => {
    await createExcuse(
      "child-1",
      new Date(2026, 7, 24),
      new Date(2026, 7, 25),
      "Nemoc",
      "director-1",
      undefined,
      { approvedById: "director-1" },
    );

    expect(mocks.createExcuseRecord).toHaveBeenCalledWith({
      data: expect.objectContaining({
        lateApprovedById: "director-1",
        lateApprovedAt: expect.any(Date),
      }),
    });
  });
});
