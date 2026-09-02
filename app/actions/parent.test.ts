import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChildGender, UserRole, type Excuse } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  getDbUser: vi.fn(),
  listParentLinks: vi.fn(),
  canManageExcuses: vi.fn(),
  createExcuse: vi.fn(),
  getSchoolDaysInRange: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getDbUser: mocks.getDbUser }));
vi.mock("@/lib/db", () => ({
  db: {
    parentLinks: { list: mocks.listParentLinks },
  },
}));
vi.mock("@/lib/school-days", () => ({
  isClosedDay: vi.fn(),
  getSchoolDaysInRange: mocks.getSchoolDaysInRange,
}));
vi.mock("@/lib/excuse", () => ({
  createExcuse: mocks.createExcuse,
  canManageExcuse: vi.fn(),
  canManageExcuses: mocks.canManageExcuses,
  canSubmitExcuse: vi.fn(),
  deleteExcuse: vi.fn(),
  updateExcuse: vi.fn(),
}));
vi.mock("@/lib/parent-calendar", () => ({
  buildParentCalendarMonth: vi.fn(),
  parseMonth: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { getParentChildren, submitExcuse } from "./parent";

const makeExcuse = (childId: string): Excuse => ({
  id: `excuse-${childId}`,
  childId,
  fromDate: new Date(2026, 8, 10),
  toDate: new Date(2026, 8, 10),
  reason: "Nemoc",
  submittedById: "parent-1",
  submittedAt: new Date(2026, 8, 1),
  lateApprovedAt: null,
  lateApprovedById: null,
  createdAt: new Date(2026, 8, 1),
  updatedAt: new Date(2026, 8, 1),
});

const makeFormData = (): FormData => {
  const formData = new FormData();
  formData.set("childId", "child-1");
  formData.append("childIds", "child-1");
  formData.append("childIds", "child-2");
  formData.set("fromDate", "2026-09-10");
  formData.set("toDate", "2026-09-10");
  formData.set("reason", " Nemoc ");
  return formData;
};

describe("submitExcuse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDbUser.mockResolvedValue({
      id: "parent-1",
      clerkId: "clerk-1",
      name: "Rodič",
      email: "rodic@example.com",
      image: null,
      role: "PARENT",
    });
    mocks.canManageExcuses.mockResolvedValue(true);
    mocks.getSchoolDaysInRange.mockResolvedValue([new Date(2026, 8, 10)]);
    mocks.createExcuse.mockImplementation((childId: string) =>
      Promise.resolve(makeExcuse(childId)),
    );
  });

  it("creates one excuse for every selected child", async () => {
    const result = await submitExcuse(makeFormData());

    expect(mocks.canManageExcuses).toHaveBeenCalledWith(
      expect.objectContaining({ id: "parent-1", role: "PARENT" }),
      ["child-1", "child-2"],
    );
    expect(mocks.createExcuse).toHaveBeenCalledTimes(2);
    expect(mocks.createExcuse).toHaveBeenNthCalledWith(
      1,
      "child-1",
      new Date(2026, 8, 10),
      new Date(2026, 8, 10),
      "Nemoc",
      "parent-1",
      [new Date(2026, 8, 10)],
    );
    expect(result.excuses.map((excuse) => excuse.childId)).toEqual([
      "child-1",
      "child-2",
    ]);
    expect(result.summary).toEqual({
      schoolDayCount: 2,
      lateDayCount: 0,
      onTimeDayCount: 2,
      automaticallyApprovedDayCount: 0,
    });
  });

  it("preserves a mixed on-time and late result per school day", async () => {
    const formData = makeFormData();
    formData.set("fromDate", "2026-08-19");
    formData.set("toDate", "2026-08-20");
    formData.delete("childIds");
    formData.append("childIds", "child-1");
    mocks.getSchoolDaysInRange.mockResolvedValue([
      new Date(2026, 7, 19),
      new Date(2026, 7, 20),
    ]);
    mocks.createExcuse.mockResolvedValue({
      ...makeExcuse("child-1"),
      fromDate: new Date(2026, 7, 19),
      toDate: new Date(2026, 7, 20),
      submittedAt: new Date(2026, 7, 18, 10),
    });

    const result = await submitExcuse(formData);

    expect(result.summary).toEqual({
      schoolDayCount: 2,
      lateDayCount: 1,
      onTimeDayCount: 1,
      automaticallyApprovedDayCount: 0,
    });
  });

  it("does not leave late days pending for a child without lunches", async () => {
    const formData = makeFormData();
    formData.delete("childIds");
    formData.append("childIds", "child-1");
    formData.set("fromDate", "2026-08-19");
    formData.set("toDate", "2026-08-19");
    mocks.getSchoolDaysInRange.mockResolvedValue([new Date(2026, 7, 19)]);
    mocks.createExcuse.mockResolvedValue({
      ...makeExcuse("child-1"),
      fromDate: new Date(2026, 7, 19),
      toDate: new Date(2026, 7, 19),
      submittedAt: new Date(2026, 7, 19, 12),
      lateApprovedAt: new Date(2026, 7, 19, 12),
    });

    const result = await submitExcuse(formData);

    expect(result.summary).toEqual({
      schoolDayCount: 1,
      lateDayCount: 0,
      onTimeDayCount: 0,
      automaticallyApprovedDayCount: 1,
    });
  });

  it("creates nothing when the parent lacks access to one selected child", async () => {
    mocks.canManageExcuses.mockResolvedValue(false);

    await expect(submitExcuse(makeFormData())).rejects.toThrow("Access denied");
    expect(mocks.createExcuse).not.toHaveBeenCalled();
  });

  it("creates nothing when no child is selected", async () => {
    const formData = makeFormData();
    formData.delete("childIds");

    await expect(submitExcuse(formData)).rejects.toThrow(
      "Vyberte alespoň jedno dítě.",
    );
    expect(mocks.canManageExcuses).not.toHaveBeenCalled();
    expect(mocks.createExcuse).not.toHaveBeenCalled();
  });
});

describe("getParentChildren", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDbUser.mockResolvedValue({
      id: "parent-1",
      role: UserRole.PARENT,
    });
  });

  it("returns only child data visible to parents", async () => {
    mocks.listParentLinks.mockResolvedValue([
      {
        child: {
          id: "child-1",
          firstName: "Anna",
          lastName: "Novakova",
          gender: ChildGender.FEMALE,
          doesNotTakeLunch: true,
          active: true,
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-02"),
        },
      },
    ]);

    await expect(getParentChildren()).resolves.toEqual([
      {
        id: "child-1",
        firstName: "Anna",
        gender: ChildGender.FEMALE,
        doesNotTakeLunch: true,
      },
    ]);
  });
});
