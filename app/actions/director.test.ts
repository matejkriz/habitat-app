import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDbUser: vi.fn(),
  childrenList: vi.fn(),
  childrenGet: vi.fn(),
  childrenUpdate: vi.fn(),
  attendanceList: vi.fn(),
  noLunchDaysList: vi.fn(),
  excusesList: vi.fn(),
  excusesGet: vi.fn(),
  excusesCreate: vi.fn(),
  excusesUpdate: vi.fn(),
  auditLogsCreate: vi.fn(),
  usersGet: vi.fn(),
  enqueueExcuse: vi.fn(),
  sendExcuseNotification: vi.fn(),
  getSchoolDaysInRange: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getDbUser: mocks.getDbUser }));
vi.mock("@/lib/db", () => ({
  db: {
    children: {
      list: mocks.childrenList,
      get: mocks.childrenGet,
      update: mocks.childrenUpdate,
      count: vi.fn(),
    },
    attendance: { list: mocks.attendanceList },
    noLunchDays: { list: mocks.noLunchDaysList },
    excuses: {
      list: mocks.excusesList,
      listOverlapping: mocks.excusesList,
      get: mocks.excusesGet,
      create: mocks.excusesCreate,
      update: mocks.excusesUpdate,
    },
    auditLogs: { create: mocks.auditLogsCreate },
    users: { get: mocks.usersGet },
    notifications: { enqueueExcuse: mocks.enqueueExcuse },
  },
}));
vi.mock("@/lib/school-days", () => ({
  getSchoolDaysInRange: mocks.getSchoolDaysInRange,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/slack", () => ({
  sendExcuseNotification: mocks.sendExcuseNotification,
}));

import {
  createDirectorExcuse,
  getExcuseChildren,
  getExcuses,
  getLunchOverview,
  updateChild,
  updateExcuse,
} from "./director";

// 19. 8. 2026 is a Wednesday and 20. 8. a Thursday.
const AUG = (day: number, hour = 0, minute = 0) => new Date(2026, 7, day, hour, minute);

const tobias = {
  id: "tobias",
  firstName: "Tobiáš",
  lastName: "Tornádo",
  doesNotTakeLunch: false,
  parents: [],
};

/** Older excuse spanning 19.-26. 8., submitted well past the deadline. */
const spanningLate = {
  id: "excuse-old",
  childId: "tobias",
  fromDate: AUG(19),
  toDate: AUG(26),
  reason: "Dovolená",
  cancelLunch: true,
  submittedById: "parent-1",
  submittedAt: AUG(19, 14),
  lateApprovedAt: null,
  lateApprovedById: null,
};

/** One-day excuse for 20. 8. that the director forgave. */
const approvedSingleDay = {
  id: "excuse-approved",
  childId: "tobias",
  fromDate: AUG(20),
  toDate: AUG(20),
  reason: "Nemoc",
  cancelLunch: true,
  submittedById: "parent-1",
  submittedAt: AUG(20, 8),
  lateApprovedAt: AUG(20, 12),
  lateApprovedById: "director-1",
};

describe("getLunchOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDbUser.mockResolvedValue({ id: "director-1", role: "DIRECTOR" });
    mocks.childrenList.mockResolvedValue([tobias]);
    mocks.getSchoolDaysInRange.mockResolvedValue([AUG(19), AUG(20)]);
    mocks.attendanceList.mockResolvedValue([
      { id: "a-19", childId: "tobias", date: AUG(19), presence: "ABSENT" },
      { id: "a-20", childId: "tobias", date: AUG(20), presence: "ABSENT" },
    ]);
    mocks.noLunchDaysList.mockResolvedValue([]);
  });

  it("shows an approved day as excused even when a late excuse also covers it", async () => {
    mocks.excusesList.mockResolvedValue([spanningLate, approvedSingleDay]);

    const overview = await getLunchOverview("2026-08");

    expect(overview.children[0].statuses).toEqual(["late", "excused"]);
    expect(overview.children[0].payableLunches).toBe(1);
  });

  it("reaches the same result whichever excuse is stored first", async () => {
    mocks.excusesList.mockResolvedValue([approvedSingleDay, spanningLate]);

    const overview = await getLunchOverview("2026-08");

    expect(overview.children[0].statuses).toEqual(["late", "excused"]);
  });

  it("charges both days while the late excuse is the only one", async () => {
    mocks.excusesList.mockResolvedValue([spanningLate]);

    const overview = await getLunchOverview("2026-08");

    expect(overview.children[0].statuses).toEqual(["late", "late"]);
    expect(overview.children[0].payableLunches).toBe(2);
  });

  it("keeps an explicitly retained lunch payable without leaving the absence pending", async () => {
    mocks.excusesList.mockResolvedValue([
      {
        ...approvedSingleDay,
        fromDate: AUG(19),
        toDate: AUG(19),
        cancelLunch: false,
        lateApprovedById: null,
      },
    ]);

    const overview = await getLunchOverview("2026-08");

    expect(overview.children[0].statuses).toEqual(["kept", "unexcused"]);
    expect(overview.children[0].payableLunches).toBe(2);
  });

  it("does not charge lunch when a morning-only child arrives after lunch", async () => {
    mocks.attendanceList.mockResolvedValue([
      { id: "a-19", childId: "tobias", date: AUG(19), presence: "PRESENT" },
      { id: "a-20", childId: "tobias", date: AUG(20), presence: "ABSENT" },
    ]);
    mocks.excusesList.mockResolvedValue([
      {
        ...approvedSingleDay,
        fromDate: AUG(19),
        toDate: AUG(19),
        dayPart: "MORNING",
      },
    ]);

    const overview = await getLunchOverview("2026-08");

    expect(overview.children[0].statuses).toEqual(["excused", "unexcused"]);
    expect(overview.children[0].payableLunches).toBe(1);
  });

  it("marks every child gray and charges nobody on a day without lunch", async () => {
    mocks.excusesList.mockResolvedValue([]);
    mocks.noLunchDaysList.mockResolvedValue([{ date: AUG(19) }]);

    const overview = await getLunchOverview("2026-08");

    expect(overview.children[0].statuses).toEqual(["no-lunch", "unexcused"]);
    expect(overview.children[0].payableLunches).toBe(1);
  });

  it("keeps children without lunches out of the table and lists their names", async () => {
    mocks.childrenList.mockResolvedValue([
      tobias,
      {
        id: "anna",
        firstName: "Anna",
        lastName: "Malá",
        doesNotTakeLunch: true,
        parents: [],
      },
    ]);
    mocks.excusesList.mockResolvedValue([]);

    const overview = await getLunchOverview("2026-08");

    expect(overview.children.map((child) => child.id)).toEqual(["tobias"]);
    expect(overview.childrenWithoutLunch).toEqual([
      { id: "anna", firstName: "Anna", lastName: "Malá" },
    ]);
  });
});

describe("updateExcuse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDbUser.mockResolvedValue({ id: "director-1", role: "DIRECTOR" });
    mocks.excusesGet.mockResolvedValue(spanningLate);
    mocks.childrenGet.mockResolvedValue({ ...tobias, active: true });
    mocks.excusesUpdate.mockImplementation((args: { data: unknown }) =>
      Promise.resolve({ ...spanningLate, ...(args.data as object) }),
    );
  });

  it("records who forgave the late submission and when", async () => {
    await updateExcuse("excuse-old", true);

    const [[call]] = mocks.excusesUpdate.mock.calls;
    expect(call.where).toEqual({ id: "excuse-old" });
    expect(call.data.lateApprovedById).toBe("director-1");
    expect(call.data.lateApprovedAt).toBeInstanceOf(Date);
  });

  it("clears the approval when the director takes it back", async () => {
    await updateExcuse("excuse-old", false);

    expect(mocks.excusesUpdate).toHaveBeenCalledWith({
      where: { id: "excuse-old" },
      data: { lateApprovedAt: null, lateApprovedById: null },
    });
  });

  it("does not revoke automatic approval for a child without lunches", async () => {
    mocks.childrenGet.mockResolvedValue({
      ...tobias,
      active: true,
      doesNotTakeLunch: true,
    });

    await expect(updateExcuse("excuse-old", false)).rejects.toThrow(
      "Omluvenky dítěte bez obědů se schvalují automaticky",
    );
    expect(mocks.excusesUpdate).not.toHaveBeenCalled();
  });

  it("does not revoke approval when the lunch was intentionally kept", async () => {
    mocks.excusesGet.mockResolvedValue({
      ...spanningLate,
      cancelLunch: false,
      lateApprovedAt: AUG(19, 14),
    });

    await expect(updateExcuse("excuse-old", false)).rejects.toThrow(
      "Omluvenku bez odhlášení oběda není potřeba schvalovat",
    );
    expect(mocks.childrenGet).not.toHaveBeenCalled();
    expect(mocks.excusesUpdate).not.toHaveBeenCalled();
  });
});

describe("updateChild", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDbUser.mockResolvedValue({ id: "director-1", role: "DIRECTOR" });
    mocks.childrenGet.mockResolvedValue({
      ...tobias,
      gender: "MALE",
      active: true,
    });
    mocks.childrenUpdate.mockImplementation(({ data }: { data: unknown }) =>
      Promise.resolve({ ...tobias, ...(data as object) }),
    );
    mocks.excusesUpdate.mockResolvedValue(undefined);
    mocks.auditLogsCreate.mockResolvedValue(undefined);
  });

  it("approves existing excuses when lunches are disabled", async () => {
    mocks.excusesList.mockResolvedValue([spanningLate, approvedSingleDay]);

    await updateChild("tobias", { doesNotTakeLunch: true });

    expect(mocks.childrenUpdate).toHaveBeenCalledWith({
      where: { id: "tobias" },
      data: { doesNotTakeLunch: true },
    });
    expect(mocks.excusesUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.excusesUpdate).toHaveBeenCalledWith({
      where: { id: "excuse-old" },
      data: {
        lateApprovedAt: expect.any(Date),
        lateApprovedById: "director-1",
      },
    });
  });
});

describe("getExcuses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDbUser.mockResolvedValue({ id: "director-1", role: "DIRECTOR" });
  });

  it("does not put an excuse for a configured closure into the pending queue", async () => {
    mocks.excusesList.mockResolvedValue([
      {
        ...spanningLate,
        fromDate: AUG(20),
        toDate: AUG(20),
        child: tobias,
        submittedBy: { id: "parent-1", name: "Rodič", email: null },
      },
    ]);
    mocks.getSchoolDaysInRange.mockResolvedValue([]);

    await expect(getExcuses({ pendingOnly: true })).resolves.toEqual([]);
    await expect(getExcuses({ settledOnly: true })).resolves.toEqual([
      expect.objectContaining({ rangeState: "ON_TIME" }),
    ]);
  });
});

describe("getExcuseChildren", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDbUser.mockResolvedValue({ id: "director-1", role: "DIRECTOR" });
  });

  it("returns the minimal sorted list of active children", async () => {
    mocks.childrenList.mockResolvedValue([
      { id: "anna", firstName: "Anna", lastName: "Malá" },
      { id: "tobias", firstName: "Tobiáš", lastName: "Tornádo" },
    ]);

    await expect(getExcuseChildren()).resolves.toEqual([
      { id: "anna", firstName: "Anna", lastName: "Malá" },
      { id: "tobias", firstName: "Tobiáš", lastName: "Tornádo" },
    ]);
    expect(mocks.childrenList).toHaveBeenCalledWith({
      where: { active: true },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
  });
});

describe("createDirectorExcuse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDbUser.mockResolvedValue({ id: "director-1", role: "DIRECTOR" });
    mocks.childrenGet.mockResolvedValue({
      id: "tobias",
      firstName: "Tobiáš",
      lastName: "Tornádo",
      active: true,
    });
    mocks.getSchoolDaysInRange.mockResolvedValue([AUG(19)]);
    mocks.excusesCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({
        id: "excuse-director",
        ...data,
        submittedAt: AUG(19, 12),
        createdAt: AUG(19, 12),
        updatedAt: AUG(19, 12),
      }),
    );
    mocks.usersGet.mockResolvedValue({ name: "Ředitelka" });
    mocks.enqueueExcuse.mockResolvedValue(undefined);
    mocks.sendExcuseNotification.mockResolvedValue(undefined);
  });

  it("creates an already approved excuse regardless of the date", async () => {
    const formData = new FormData();
    formData.set("childId", "tobias");
    formData.set("fromDate", "2026-08-19");
    formData.set("toDate", "2026-08-19");
    formData.set("reason", " Nemoc ");

    await expect(createDirectorExcuse(formData)).resolves.toEqual({
      success: true,
    });

    expect(mocks.excusesCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        childId: "tobias",
        submittedById: "director-1",
        reason: "Nemoc",
        cancelLunch: true,
        lateApprovedById: "director-1",
        lateApprovedAt: expect.any(Date),
      }),
    });
  });

  it("stores the director's choice to keep lunch", async () => {
    const formData = new FormData();
    formData.set("childId", "tobias");
    formData.set("fromDate", "2026-08-19");
    formData.set("toDate", "2026-08-19");
    formData.set("cancelLunch", "false");

    await expect(createDirectorExcuse(formData)).resolves.toEqual({
      success: true,
    });
    expect(mocks.excusesCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ cancelLunch: false }),
    });
  });

  it("stores an afternoon absence with the requested lunch cancellation", async () => {
    const formData = new FormData();
    formData.set("childId", "tobias");
    formData.set("fromDate", "2026-08-19");
    formData.set("toDate", "2026-08-19");
    formData.set("dayPart", "AFTERNOON");
    formData.set("cancelLunch", "true");

    await expect(createDirectorExcuse(formData)).resolves.toEqual({
      success: true,
    });
    expect(mocks.excusesCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dayPart: "AFTERNOON",
        cancelLunch: true,
      }),
    });
  });

  it("forces whole day when a submitted range spans multiple dates", async () => {
    const formData = new FormData();
    formData.set("childId", "tobias");
    formData.set("fromDate", "2026-08-19");
    formData.set("toDate", "2026-08-20");
    formData.set("dayPart", "MORNING");

    await expect(createDirectorExcuse(formData)).resolves.toEqual({
      success: true,
    });
    expect(mocks.excusesCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ dayPart: "FULL_DAY" }),
    });
  });

  it("rejects an invalid day part safely", async () => {
    const formData = new FormData();
    formData.set("childId", "tobias");
    formData.set("fromDate", "2026-08-19");
    formData.set("toDate", "2026-08-19");
    formData.set("dayPart", "EVENING");

    await expect(createDirectorExcuse(formData)).resolves.toEqual({
      success: false,
      error: "Neplatná část dne.",
    });
    expect(mocks.childrenGet).not.toHaveBeenCalled();
    expect(mocks.excusesCreate).not.toHaveBeenCalled();
  });

  it("rejects an invalid lunch choice safely", async () => {
    const formData = new FormData();
    formData.set("childId", "tobias");
    formData.set("fromDate", "2026-08-19");
    formData.set("toDate", "2026-08-19");
    formData.set("cancelLunch", "on");

    await expect(createDirectorExcuse(formData)).resolves.toEqual({
      success: false,
      error: "Neplatná volba pro odhlášení oběda.",
    });
    expect(mocks.childrenGet).not.toHaveBeenCalled();
    expect(mocks.excusesCreate).not.toHaveBeenCalled();
  });

  it("creates nothing for a missing or inactive child", async () => {
    mocks.childrenGet.mockResolvedValue(null);
    const formData = new FormData();
    formData.set("childId", "unknown");
    formData.set("fromDate", "2026-08-19");
    formData.set("toDate", "2026-08-19");

    await expect(createDirectorExcuse(formData)).resolves.toEqual({
      success: false,
      error: "Dítě nebylo nalezeno.",
    });
    expect(mocks.excusesCreate).not.toHaveBeenCalled();
  });

  it("returns a safe validation result for an invalid date range", async () => {
    const formData = new FormData();
    formData.set("childId", "tobias");
    formData.set("fromDate", "2026-08-20");
    formData.set("toDate", "2026-08-19");

    await expect(createDirectorExcuse(formData)).resolves.toEqual({
      success: false,
      error: "Datum konce nesmí být před datem začátku.",
    });
    expect(mocks.getSchoolDaysInRange).not.toHaveBeenCalled();
    expect(mocks.excusesCreate).not.toHaveBeenCalled();
  });

  it("does not allow a non-director to create the excuse", async () => {
    mocks.getDbUser.mockResolvedValue({ id: "parent-1", role: "PARENT" });
    const formData = new FormData();
    formData.set("childId", "tobias");
    formData.set("fromDate", "2026-08-19");
    formData.set("toDate", "2026-08-19");

    await expect(createDirectorExcuse(formData)).rejects.toThrow("Unauthorized");
    expect(mocks.childrenGet).not.toHaveBeenCalled();
    expect(mocks.excusesCreate).not.toHaveBeenCalled();
  });
});
