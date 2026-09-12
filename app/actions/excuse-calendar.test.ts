import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDbUser: vi.fn(),
  closedDaysList: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getDbUser: mocks.getDbUser }));
vi.mock("@/lib/db", () => ({
  db: {
    closedDays: { list: mocks.closedDaysList },
  },
}));
vi.mock("@/lib/attendance-calendar", () => ({
  buildAttendanceCalendar: vi.fn(),
}));
vi.mock("@/lib/excuse", () => ({ getExcusesOverlapping: vi.fn() }));

type ExcuseCalendarAction = (
  monthKey: string,
) => Promise<{ readonly monthKey: string; readonly closedDateKeys: ReadonlyArray<string> }>;

async function getAction(): Promise<ExcuseCalendarAction | undefined> {
  const actions = await import("./calendar");
  return (actions as typeof actions & { getExcuseCalendarMonth?: ExcuseCalendarAction })
    .getExcuseCalendarMonth;
}

describe("getExcuseCalendarMonth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDbUser.mockResolvedValue({ id: "parent-1", role: "PARENT" });
    mocks.closedDaysList.mockResolvedValue([
      { date: new Date(2026, 8, 14), description: "Ředitelské volno" },
    ]);
  });

  it.each(["PARENT", "DIRECTOR"])(
    "returns custom closed dates for an authenticated %s excuse form",
    async (role) => {
      mocks.getDbUser.mockResolvedValue({ id: "user-1", role });
      const action = await getAction();
      expect(action).toBeTypeOf("function");
      if (!action) return;

      await expect(action("2026-09")).resolves.toEqual({
        monthKey: "2026-09",
        closedDateKeys: ["2026-09-14"],
      });
      expect(mocks.closedDaysList).toHaveBeenCalledWith({
        where: {
          date: {
            gte: new Date(2026, 8, 1),
            lte: new Date(2026, 9, 0, 23, 59, 59, 999),
          },
        },
        select: { date: true },
      });
    },
  );

  it("rejects users who cannot add excuses", async () => {
    mocks.getDbUser.mockResolvedValue({ id: "teacher-1", role: "TEACHER" });
    const action = await getAction();
    expect(action).toBeTypeOf("function");
    if (!action) return;

    await expect(action("2026-09")).rejects.toThrow("Unauthorized");
    expect(mocks.closedDaysList).not.toHaveBeenCalled();
  });
});
