import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), details: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getDbUser: mocks.user }));
vi.mock("@/lib/excuse", () => ({ getExcusesOverlapping: async () => [] }));
vi.mock("@/lib/db", () => ({ db: {
  children: { list: async () => [] }, attendance: { list: async () => [] },
  closedDays: { list: async () => [] }, noLunchDays: { list: async () => [] },
  dayDetails: { list: mocks.details },
} }));
import { getAttendanceCalendarMonth } from "./calendar";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.details.mockResolvedValue([{ date: new Date(2026, 8, 10).getTime(), name: "Jarmark", expense: 100, report: "Soukromé poznámky" }]);
});
it.each(["TEACHER", "DIRECTOR"])("restricts calendar details for %s", async role => {
  mocks.user.mockResolvedValue({ role });
  const calendar = await getAttendanceCalendarMonth("2026-09");
  const day = calendar.days.find(day => day.dateKey === "2026-09-10")!;
  expect(day.name).toBe("Jarmark");
  expect(day).not.toHaveProperty("report");
  expect(calendar.canManageDetails).toBe(role === "DIRECTOR");
  if (role === "DIRECTOR") expect(day.expense).toBe(100);
  else expect(day).not.toHaveProperty("expense");
});
