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
import { loadLunchOverview } from "@/lib/lunch-overview";
import { LunchStatus } from "@/lib/lunches";
import { ChildGender, ExcuseDayPart } from "@/lib/types";
const date = new Date(2026, 8, 10);
const timelyExcuse = {
  id: "excuse",
  childId: "own",
  fromDate: date,
  toDate: date,
  dayPart: ExcuseDayPart.FULL_DAY,
  cancelLunch: true,
  submittedAt: new Date(2026, 8, 9, 8),
  lateApprovedAt: null,
};
const lateSubmission = new Date(2026, 8, 10, 10);
const forgiveness = new Date(2026, 8, 10, 11);

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
  it.each([
    { scenario: "timely whole-day excuse", excuses: [timelyExcuse], expected: LunchStatus.EXCUSED, payableLunches: 0 },
    { scenario: "late whole-day excuse", excuses: [{ ...timelyExcuse, submittedAt: lateSubmission }], expected: LunchStatus.LATE, payableLunches: 1 },
    { scenario: "forgiven whole-day lunch", excuses: [{ ...timelyExcuse, submittedAt: lateSubmission, lateApprovedAt: forgiveness }], expected: LunchStatus.EXCUSED, payableLunches: 0 },
    { scenario: "kept whole-day lunch", excuses: [{ ...timelyExcuse, cancelLunch: false }], expected: LunchStatus.KEPT, payableLunches: 1 },
    { scenario: "no excuse", excuses: [], expected: LunchStatus.PRESENT, payableLunches: 1 },
    { scenario: "timely morning excuse", excuses: [{ ...timelyExcuse, dayPart: ExcuseDayPart.MORNING }], expected: LunchStatus.EXCUSED, payableLunches: 0 },
    { scenario: "late morning excuse", excuses: [{ ...timelyExcuse, dayPart: ExcuseDayPart.MORNING, submittedAt: lateSubmission }], expected: LunchStatus.LATE, payableLunches: 1 },
    { scenario: "kept morning lunch", excuses: [{ ...timelyExcuse, dayPart: ExcuseDayPart.MORNING, cancelLunch: false }], expected: LunchStatus.KEPT, payableLunches: 1 },
    { scenario: "timely afternoon excuse", excuses: [{ ...timelyExcuse, dayPart: ExcuseDayPart.AFTERNOON }], expected: LunchStatus.KEPT, payableLunches: 1 },
    { scenario: "late afternoon excuse", excuses: [{ ...timelyExcuse, dayPart: ExcuseDayPart.AFTERNOON, submittedAt: lateSubmission }], expected: LunchStatus.LATE, payableLunches: 1 },
    { scenario: "forgiven afternoon lunch", excuses: [{ ...timelyExcuse, dayPart: ExcuseDayPart.AFTERNOON, submittedAt: lateSubmission, lateApprovedAt: forgiveness }], expected: LunchStatus.KEPT, payableLunches: 1 },
  ])("counts lunches from a $scenario without attendance for parent and director", async ({ excuses, expected, payableLunches }) => {
    mocks.children.mockResolvedValue([{ id: "own", firstName: "Anna", lastName: "Malá", active: true, doesNotTakeLunch: false, parents: [] }]);
    mocks.attendance.mockResolvedValue([]);
    mocks.excuses.mockResolvedValue(excuses);

    const parentData = await getParentLunchOverview("2026-09");
    const directorData = await loadLunchOverview("2026-09");

    for (const data of [parentData, directorData]) {
      expect(data.children[0]).toMatchObject({ statuses: [expected], payableLunches });
      expect(data.children[0]).not.toHaveProperty("displayStatuses");
    }
  });

  it.each([
    { presence: "PRESENT", scenario: "no excuse", excuses: [], expected: LunchStatus.PRESENT },
    { presence: "ABSENT", scenario: "no excuse", excuses: [], expected: LunchStatus.UNEXCUSED },
    { presence: "PRESENT", scenario: "an afternoon excuse", excuses: [{ ...timelyExcuse, dayPart: ExcuseDayPart.AFTERNOON }], expected: LunchStatus.PRESENT },
    { presence: "ABSENT", scenario: "an afternoon excuse", excuses: [{ ...timelyExcuse, dayPart: ExcuseDayPart.AFTERNOON }], expected: LunchStatus.UNEXCUSED },
  ])("keeps recorded $presence attendance authoritative with $scenario", async ({ presence, excuses, expected }) => {
    mocks.attendance.mockResolvedValue([{ childId: "own", date, presence }]);
    mocks.excuses.mockResolvedValue(excuses);

    const data = await getParentLunchOverview("2026-09");

    expect(data.children[0]).toMatchObject({ statuses: [expected], payableLunches: 1 });
  });

  it.each([false, true])("retains the child's gender in lunch rows (parent=%s)", async parent => {
    const child = { id: "own", firstName: "Anna", lastName: "Malá", gender: ChildGender.FEMALE, active: true, doesNotTakeLunch: false };
    mocks.parentLinks.mockResolvedValue([{ child }]);
    mocks.children.mockResolvedValue([{ ...child, parents: [] }]);

    const data = await loadLunchOverview("2026-09", parent ? "parent" : undefined);

    expect(data.children[0].gender).toBe(ChildGender.FEMALE);
  });

  it("returns a null gender for legacy children without that field", async () => {
    const data = await getParentLunchOverview("2026-09");

    expect(data.children[0].gender).toBeNull();
  });

  it.each([
    { scenario: "unscheduled day", excuses: [], expected: LunchStatus.NOT_SCHEDULED, payableLunches: 0 },
    { scenario: "makeup with lunch", excuses: [{ ...timelyExcuse, kind: "MAKEUP", cancelLunch: false }], expected: LunchStatus.MAKEUP, payableLunches: 1 },
    { scenario: "makeup without lunch", excuses: [{ ...timelyExcuse, kind: "MAKEUP", cancelLunch: true }], expected: LunchStatus.MAKEUP_NO_LUNCH, payableLunches: 0 },
  ])("preserves the existing $scenario status without attendance", async ({ excuses, expected, payableLunches }) => {
    mocks.parentLinks.mockResolvedValue([{ child: { id: "own", firstName: "Anna", lastName: "Malá", active: true, doesNotTakeLunch: false, attendanceDays: [1, 2, 3] } }]);
    mocks.attendance.mockResolvedValue([]);
    mocks.excuses.mockResolvedValue(excuses);

    const data = await getParentLunchOverview("2026-09");

    expect(data.children[0]).toMatchObject({ statuses: [expected], payableLunches });
  });

  it("keeps parent and director totals aligned across assumed presence and recorded absence", async () => {
    const nextDay = new Date(2026, 8, 14);
    mocks.children.mockResolvedValue([{ id: "own", firstName: "Anna", lastName: "Malá", active: true, doesNotTakeLunch: false, parents: [] }]);
    mocks.schoolDays.mockResolvedValue([date, nextDay]);
    mocks.attendance.mockResolvedValue([{ childId: "own", date: nextDay, presence: "ABSENT" }]);

    const parentData = await getParentLunchOverview("2026-09");
    const directorData = await loadLunchOverview("2026-09");

    for (const data of [parentData, directorData]) {
      expect(data.children[0]).toMatchObject({ statuses: [LunchStatus.PRESENT, LunchStatus.UNEXCUSED], payableLunches: 2 });
      expect(data.children[0].payableLunches * data.priceCents).toBe(11000);
    }
  });

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
