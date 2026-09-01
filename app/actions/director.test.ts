import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDbUser: vi.fn(),
  childrenList: vi.fn(),
  childrenGet: vi.fn(),
  attendanceList: vi.fn(),
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
      count: vi.fn(),
    },
    attendance: { list: mocks.attendanceList },
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
  updateExcuse,
} from "./director";

// 19. 8. 2026 is a Wednesday and 20. 8. a Thursday.
const AUG = (day: number, hour = 0, minute = 0) => new Date(2026, 7, day, hour, minute);

const tobias = {
  id: "tobias",
  firstName: "Tobiáš",
  lastName: "Tornádo",
  parents: [],
};

/** Older excuse spanning 19.-26. 8., submitted well past the deadline. */
const spanningLate = {
  id: "excuse-old",
  childId: "tobias",
  fromDate: AUG(19),
  toDate: AUG(26),
  reason: "Dovolená",
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
});

describe("updateExcuse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDbUser.mockResolvedValue({ id: "director-1", role: "DIRECTOR" });
    mocks.excusesGet.mockResolvedValue(spanningLate);
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
        lateApprovedById: "director-1",
        lateApprovedAt: expect.any(Date),
      }),
    });
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
