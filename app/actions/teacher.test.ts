import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDbUser: vi.fn(),
  isClosedDay: vi.fn(),
  attendanceList: vi.fn(),
  excusesList: vi.fn(),
  noLunchDayGet: vi.fn(),
  noLunchDaySet: vi.fn(),
  auditLogsCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getDbUser: mocks.getDbUser }));
vi.mock("@/lib/school-days", () => ({ isClosedDay: mocks.isClosedDay }));
vi.mock("@/lib/db", () => ({
  db: {
    attendance: { list: mocks.attendanceList },
    excuses: { listOverlapping: mocks.excusesList },
    noLunchDays: { get: mocks.noLunchDayGet, set: mocks.noLunchDaySet },
    auditLogs: { create: mocks.auditLogsCreate },
  },
}));
vi.mock("@/lib/attendance", () => ({
  recordBulkAttendance: vi.fn(),
  canEnterAttendance: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { getAttendanceForDate, setNoLunchForDate } from "./teacher";

describe("getAttendanceForDate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDbUser.mockResolvedValue({ id: "teacher-1", role: "TEACHER" });
    mocks.isClosedDay.mockResolvedValue(false);
    mocks.attendanceList.mockResolvedValue([]);
    mocks.noLunchDayGet.mockResolvedValue(null);
  });

  it("returns excuses covering the selected day with their daily state", async () => {
    mocks.excusesList.mockResolvedValue([
      {
        id: "excuse-current",
        childId: "child-1",
        fromDate: new Date(2026, 7, 18),
        toDate: new Date(2026, 7, 20),
        submittedAt: new Date(2026, 7, 10, 8),
        lateApprovedAt: null,
      },
      {
        id: "excuse-ended",
        childId: "child-2",
        fromDate: new Date(2026, 7, 1),
        toDate: new Date(2026, 7, 10),
        submittedAt: new Date(2026, 7, 5, 10),
        lateApprovedAt: null,
      },
    ]);

    await expect(getAttendanceForDate("2026-08-19")).resolves.toMatchObject({
      isClosed: false,
      excuses: [
        {
          childId: "child-1",
          state: "ON_TIME",
        },
      ],
    });
  });

  it("treats a day as late only when its own deadline had passed", async () => {
    // Submitted after 9:00 the day before 19. 8., but days in advance for the rest.
    mocks.excusesList.mockResolvedValue([
      {
        id: "excuse-late-start",
        childId: "child-1",
        fromDate: new Date(2026, 7, 19),
        toDate: new Date(2026, 7, 26),
        submittedAt: new Date(2026, 7, 18, 10),
        lateApprovedAt: null,
      },
    ]);

    await expect(getAttendanceForDate("2026-08-19")).resolves.toMatchObject({
      excuses: [{ childId: "child-1", state: "LATE" }],
    });
    await expect(getAttendanceForDate("2026-08-20")).resolves.toMatchObject({
      excuses: [{ childId: "child-1", state: "ON_TIME" }],
    });
  });

  it("does not relabel a director-approved late excuse as on time", async () => {
    mocks.excusesList.mockResolvedValue([
      {
        id: "excuse-approved-late",
        childId: "child-1",
        fromDate: new Date(2026, 7, 19),
        toDate: new Date(2026, 7, 19),
        submittedAt: new Date(2026, 7, 19, 14),
        lateApprovedAt: new Date(2026, 7, 20, 12),
      },
    ]);

    await expect(getAttendanceForDate("2026-08-19")).resolves.toMatchObject({
      excuses: [{ childId: "child-1", state: "LATE_APPROVED" }],
    });
  });

  it("reports when a late excused absence keeps the lunch", async () => {
    mocks.excusesList.mockResolvedValue([
      {
        id: "excuse-lunch-kept",
        childId: "child-1",
        fromDate: new Date(2026, 7, 19),
        toDate: new Date(2026, 7, 19),
        cancelLunch: false,
        submittedAt: new Date(2026, 7, 19, 14),
        lateApprovedAt: new Date(2026, 7, 19, 14),
      },
    ]);

    await expect(getAttendanceForDate("2026-08-19")).resolves.toMatchObject({
      excuses: [
        {
          childId: "child-1",
          state: "LATE_APPROVED",
          lunchCancelled: false,
        },
      ],
    });
  });

  it("returns whether the director can manage a day without lunch", async () => {
    mocks.getDbUser.mockResolvedValue({ id: "director-1", role: "DIRECTOR" });
    mocks.excusesList.mockResolvedValue([]);
    mocks.noLunchDayGet.mockResolvedValue({ id: "no-lunch-1" });

    await expect(getAttendanceForDate("2026-08-19")).resolves.toMatchObject({
      noLunch: true,
      canManageLunch: true,
    });
  });
});

describe("setNoLunchForDate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDbUser.mockResolvedValue({ id: "director-1", role: "DIRECTOR" });
    mocks.isClosedDay.mockResolvedValue(false);
    mocks.noLunchDaySet.mockResolvedValue(true);
    mocks.auditLogsCreate.mockResolvedValue({});
  });

  it("atomically marks the selected day and records the director", async () => {
    await expect(setNoLunchForDate("2026-08-19", true)).resolves.toEqual({
      noLunch: true,
    });

    expect(mocks.noLunchDaySet).toHaveBeenCalledWith({
      date: new Date(2026, 7, 19),
      noLunch: true,
      recordedById: "director-1",
    });
  });

  it("rejects teachers", async () => {
    mocks.getDbUser.mockResolvedValue({ id: "teacher-1", role: "TEACHER" });

    await expect(setNoLunchForDate("2026-08-19", true)).rejects.toThrow("Unauthorized");
    expect(mocks.noLunchDaySet).not.toHaveBeenCalled();
  });
});
