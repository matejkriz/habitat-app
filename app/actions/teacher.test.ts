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
    excuses: { list: mocks.excusesList },
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

  it("returns excuses covering the selected day with their timeliness", async () => {
    mocks.excusesList.mockResolvedValue([
      {
        id: "excuse-current",
        childId: "child-1",
        fromDate: new Date("2026-08-18"),
        toDate: new Date("2026-08-20"),
        autoApproved: true,
      },
      {
        id: "excuse-ended",
        childId: "child-2",
        fromDate: new Date("2026-08-01"),
        toDate: new Date("2026-08-10"),
        autoApproved: false,
      },
    ]);

    await expect(getAttendanceForDate("2026-08-19")).resolves.toMatchObject({
      isClosed: false,
      excuses: [
        {
          childId: "child-1",
          isOnTime: true,
        },
      ],
    });
    expect(mocks.excusesList).toHaveBeenCalledWith({
      where: { fromDate: { lte: new Date("2026-08-19T00:00:00") } },
      orderBy: { submittedAt: "desc" },
    });
  });
});
