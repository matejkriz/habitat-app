import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), access: vi.fn(), details: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getDbUser: mocks.user }));
vi.mock("@/lib/excuse", () => ({ canSubmitExcuse: mocks.access, getExcusesOverlapping: async () => [] }));
vi.mock("@/lib/db", () => ({ db: {
  attendance: { list: async () => [] },
  closedDays: { list: async () => [] },
  dayDetails: { list: mocks.details },
} }));
import { getChildCalendarMonth } from "./parent";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ id: "parent", role: "PARENT" });
  mocks.access.mockResolvedValue(true);
  mocks.details.mockResolvedValue([{ date: new Date(2026, 8, 10).getTime(), name: "Jarmark", expense: 100 }]);
});
it("includes day names in the parent calendar without exposing expenses", async () => {
  const days = await getChildCalendarMonth("child", "2026-09");
  const day = days.find(day => day.date === "2026-09-10");
  expect(day?.name).toBe("Jarmark");
  expect(day).not.toHaveProperty("expense");
  expect(days.find(day => day.date === "2026-09-11")?.name).toBeNull();
});
it("does not read calendar details for an unrelated child", async () => {
  mocks.access.mockResolvedValue(false);
  await expect(getChildCalendarMonth("other-child", "2026-09")).rejects.toThrow("Access denied");
  expect(mocks.details).not.toHaveBeenCalled();
});
