import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDbUser: vi.fn(),
  childrenList: vi.fn(),
  attendanceList: vi.fn(),
  excusesList: vi.fn(),
  excusesGet: vi.fn(),
  excusesUpdate: vi.fn(),
  auditLogsCreate: vi.fn(),
  getSchoolDaysInRange: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getDbUser: mocks.getDbUser }));
vi.mock("@/lib/db", () => ({
  db: {
    children: { list: mocks.childrenList, count: vi.fn() },
    attendance: { list: mocks.attendanceList },
    excuses: {
      list: mocks.excusesList,
      listOverlapping: mocks.excusesList,
      get: mocks.excusesGet,
      update: mocks.excusesUpdate,
    },
    auditLogs: { create: mocks.auditLogsCreate },
  },
}));
vi.mock("@/lib/school-days", () => ({
  getSchoolDaysInRange: mocks.getSchoolDaysInRange,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { getExcuses, getLunchOverview, updateExcuse } from "./director";

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
