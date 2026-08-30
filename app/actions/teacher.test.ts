import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDbUser: vi.fn(),
  isClosedDay: vi.fn(),
  attendanceList: vi.fn(),
  excusesList: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getDbUser: mocks.getDbUser }));
vi.mock("@/lib/school-days", () => ({ isClosedDay: mocks.isClosedDay }));
vi.mock("@/lib/db", () => ({
  db: {
    attendance: { list: mocks.attendanceList },
    excuses: { listOverlapping: mocks.excusesList },
  },
}));
vi.mock("@/lib/attendance", () => ({
  recordBulkAttendance: vi.fn(),
  canEnterAttendance: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { getAttendanceForDate } from "./teacher";

describe("getAttendanceForDate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDbUser.mockResolvedValue({ id: "teacher-1", role: "TEACHER" });
    mocks.isClosedDay.mockResolvedValue(false);
    mocks.attendanceList.mockResolvedValue([]);
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
});
