import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), parentLinks: vi.fn(), children: vi.fn(), attendance: vi.fn(), excuses: vi.fn(), schoolDays: vi.fn(), noLunchDays: vi.fn(), parentFunds: vi.fn(), lunchPrice: vi.fn(), lunchPayments: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getDbUser: mocks.user }));
vi.mock("@/lib/db", () => ({ db: {
  lunchPrice: { get: mocks.lunchPrice },
  lunchPayments: { list: mocks.lunchPayments },
  parentLinks: { list: mocks.parentLinks }, children: { list: mocks.children }, attendance: { list: mocks.attendance }, noLunchDays: { list: mocks.noLunchDays }, tripFunds: { parentOverview: mocks.parentFunds },
} }));
vi.mock("@/lib/excuse", () => ({ getExcusesOverlapping: mocks.excuses }));
vi.mock("@/lib/school-days", () => ({ getSchoolDaysInRange: mocks.schoolDays }));
import { getParentLunchOverview, getParentTripFundOverview } from "./parent-overviews";
const date = new Date(2026, 8, 10);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ id: "parent", role: "PARENT" });
  mocks.parentLinks.mockResolvedValue([
    { child: { id: "own", firstName: "Anna", lastName: "Malá", active: true, doesNotTakeLunch: false } },
    { child: { id: "sibling", firstName: "Eva", lastName: "Malá", active: true, doesNotTakeLunch: true } },
  ]);
  mocks.children.mockResolvedValue([{ id: "stranger", firstName: "Foreign", lastName: "Child", active: true, parents: [] }]);
  mocks.attendance.mockResolvedValue([{ childId: "own", date, presence: "PRESENT" }, { childId: "stranger", date, presence: "ABSENT" }]);
  mocks.excuses.mockResolvedValue([]);
  mocks.schoolDays.mockResolvedValue([date]);
  mocks.noLunchDays.mockResolvedValue([]);
  mocks.lunchPrice.mockResolvedValue(5500);
  mocks.lunchPayments.mockResolvedValue([]);
  mocks.parentFunds.mockResolvedValue({ days: [], children: [] });
});

describe("parent overview actions", () => {
  it("uses the last actual open day for billing even when lunch is not served that day", async () => {
    const lastDay = new Date(2026, 8, 30);
    mocks.schoolDays.mockResolvedValue([date, lastDay]);
    mocks.noLunchDays.mockResolvedValue([{ date: lastDay }]);
    const data = await getParentLunchOverview("2026-09");
    expect(data.days.map(day => day.key)).toEqual(["2026-09-10"]);
    expect(data.lastOpenDay).toBe("2026-09-30");
    mocks.schoolDays.mockResolvedValue([]);
    expect((await getParentLunchOverview("2026-09")).lastOpenDay).toBeNull();
  });

  it("loads the selected month's paid state only for the parent's own children", async () => {
    mocks.lunchPayments.mockResolvedValue([{ childId: "own", paid: true }, { childId: "stranger", paid: true }]);
    const data = await getParentLunchOverview("2026-09");
    expect(mocks.lunchPayments).toHaveBeenCalledWith("2026-09");
    expect(data.children[0].paid).toBe(true);
    expect(JSON.stringify(data)).not.toContain("stranger");
    mocks.lunchPayments.mockResolvedValue([]);
    expect((await getParentLunchOverview("2026-10")).children[0].paid).toBe(false);
  });

  it.each([null, { role: "TEACHER" }, { role: "DIRECTOR" }])("rejects unauthenticated and non-parent reads (%j)", async user => {
    mocks.user.mockResolvedValue(user);
    await expect(getParentLunchOverview("2026-09")).rejects.toThrow("Unauthorized");
    await expect(getParentTripFundOverview()).rejects.toThrow("Unauthorized");
    expect(mocks.parentLinks).not.toHaveBeenCalled();
    expect(mocks.parentFunds).not.toHaveBeenCalled();
  });

  it("scopes both lunch rows and the no-lunch list to the authenticated parent's children", async () => {
    const data = await getParentLunchOverview("2026-09");
    expect(mocks.parentLinks).toHaveBeenCalledWith(expect.objectContaining({ where: { parentId: "parent" } }));
    expect(mocks.children).not.toHaveBeenCalled();
    expect(data.priceCents).toBe(5500);
    expect(mocks.lunchPrice).toHaveBeenCalledWith("2026-09");
    expect(data.children).toEqual([expect.objectContaining({ id: "own", payableLunches: 1 })]);
    expect(data.childrenWithoutLunch.map(child => child.id)).toEqual(["sibling"]);
    expect(JSON.stringify(data)).not.toContain("stranger");
  });

  it("omits days without lunch while retaining the other days and totals", async () => {
    const nextDay = new Date(2026, 8, 11);
    mocks.schoolDays.mockResolvedValue([date, nextDay]);
    mocks.noLunchDays.mockResolvedValue([{ date: nextDay }]);

    const data = await getParentLunchOverview("2026-09");

    expect(data.days.map(day => day.key)).toEqual(["2026-09-10"]);
    expect(data.children[0].statuses).toEqual(["present"]);
    expect(data.children[0].payableLunches).toBe(1);
  });

  it("returns no columns or charges when the whole month has no lunches", async () => {
    mocks.noLunchDays.mockResolvedValue([{ date }]);

    const data = await getParentLunchOverview("2026-09");

    expect(data.days).toEqual([]);
    expect(data.children[0].statuses).toEqual([]);
    expect(data.children[0].payableLunches).toBe(0);
  });

  it("derives fund ownership from the session and never accepts a requested parent id", async () => {
    await getParentTripFundOverview();
    expect(mocks.parentFunds).toHaveBeenCalledWith("parent");
  });

  it("handles an account without linked children and validates the month", async () => {
    mocks.parentLinks.mockResolvedValue([]);
    expect((await getParentLunchOverview("2026-09")).children).toEqual([]);
    await expect(getParentLunchOverview("2026-99")).rejects.toThrow("Neplatný měsíc");
  });
});
