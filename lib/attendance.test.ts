import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getChild: vi.fn(), listAttendance: vi.fn(), getAttendance: vi.fn(),
  getSchoolDays: vi.fn(), isClosedDay: vi.fn(), getExcuses: vi.fn(),
}));
vi.mock("./db", () => ({ db: {
  children: { get: mocks.getChild },
  attendance: { list: mocks.listAttendance, get: mocks.getAttendance },
} }));
vi.mock("./school-days", () => ({ getSchoolDaysInRange: mocks.getSchoolDays, isClosedDay: mocks.isClosedDay }));
vi.mock("./excuse", () => ({ getExcusesOverlapping: mocks.getExcuses }));
import { getChildAttendanceStats, getTodayStatus } from "./attendance";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getChild.mockResolvedValue({ attendanceStartDate: "2026-09-16" });
  mocks.getExcuses.mockResolvedValue([]);
  mocks.isClosedDay.mockResolvedValue(false);
});
afterEach(() => vi.useRealTimers());

describe("attendance start", () => {
  it("counts school days and recorded attendance only from the child's first day", async () => {
    const days = [14, 15, 16, 17].map(day => new Date(2026, 8, day));
    mocks.getSchoolDays.mockResolvedValue(days);
    mocks.listAttendance.mockResolvedValue(days.map((date, index) => ({
      date, presence: index === 3 ? "ABSENT" : "PRESENT",
    })));
    await expect(getChildAttendanceStats("child", days[0], days[3])).resolves.toEqual({
      totalDays: 2, presentDays: 1, absentDays: 1, excusedDays: 0, unexcusedDays: 1, attendanceRate: 50,
    });
  });

  it("does not return today's stale attendance before the child starts", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 15, 12));
    mocks.getAttendance.mockResolvedValue({ presence: "PRESENT" });
    await expect(getTodayStatus("child")).resolves.toEqual({ isSchoolDay: false, isClosed: false, attendance: null });
    expect(mocks.getAttendance).not.toHaveBeenCalled();
  });
});
