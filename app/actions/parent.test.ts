import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChildGender, UserRole, type Excuse } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  getDbUser: vi.fn(),
  listParentLinks: vi.fn(),
  canManageExcuses: vi.fn(),
  createParentExcuses: vi.fn(),
  getSchoolDaysInRange: vi.fn(),
  revalidatePath: vi.fn(),
  childrenGet: vi.fn(), attendanceGet: vi.fn(), isClosedDay: vi.fn(), getExcusesOverlapping: vi.fn(),
  excusesList: vi.fn(), canSubmitExcuse: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getDbUser: mocks.getDbUser }));
vi.mock("@/lib/db", () => ({
  db: {
    parentLinks: { list: mocks.listParentLinks },
    children: { get: mocks.childrenGet }, attendance: { get: mocks.attendanceGet },
    excuses: { list: mocks.excusesList },
  },
}));
vi.mock("@/lib/school-days", () => ({
  isClosedDay: mocks.isClosedDay,
  getSchoolDaysInRange: mocks.getSchoolDaysInRange,
}));
vi.mock("@/lib/excuse", () => ({
  createParentExcuses: mocks.createParentExcuses,
  getExcusesOverlapping: mocks.getExcusesOverlapping,
  canManageExcuse: vi.fn(),
  canManageExcuses: mocks.canManageExcuses,
  canSubmitExcuse: mocks.canSubmitExcuse,
  deleteExcuse: vi.fn(),
  updateExcuse: vi.fn(),
}));
vi.mock("@/lib/parent-calendar", () => ({
  buildParentCalendarMonth: vi.fn(),
  parseMonth: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { getParentChildren, getChildExcuses, getChildTodayStatus, submitExcuse, submitMakeup } from "./parent";

const makeExcuse = (childId: string): Excuse => ({
  id: `excuse-${childId}`,
  childId,
  fromDate: new Date(2026, 8, 10),
  toDate: new Date(2026, 8, 10),
  reason: "Nemoc",
  dayPart: "FULL_DAY",
  cancelLunch: true,
  submittedById: "parent-1",
  submittedAt: new Date(2026, 8, 1),
  lateApprovedAt: null,
  lateApprovedById: null,
  createdAt: new Date(2026, 8, 1),
  updatedAt: new Date(2026, 8, 1),
});

const makeFormData = (): FormData => {
  const formData = new FormData();
  formData.set("requestId", "request-1234567890");
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
    mocks.listParentLinks.mockResolvedValue([1, 2].map(id => ({ child: { id: `child-${id}`, active: true } })));
    mocks.getSchoolDaysInRange.mockResolvedValue([new Date(2026, 8, 10)]);
    mocks.createParentExcuses.mockImplementation(({ childIds }: { childIds: string[] }) =>
      Promise.resolve(childIds.map(makeExcuse)),
    );
  });

  it("creates one excuse for every selected child", async () => {
    const result = await submitExcuse(makeFormData());
    if (!result.success) throw new Error(result.error);

    expect(mocks.canManageExcuses).toHaveBeenCalledWith(
      expect.objectContaining({ id: "parent-1", role: "PARENT" }),
      ["child-1", "child-2"],
    );
    expect(mocks.createParentExcuses).toHaveBeenCalledOnce();
    expect(mocks.createParentExcuses).toHaveBeenCalledWith({
      parentId: "parent-1", requestId: "request-1234567890", childIds: ["child-1", "child-2"],
      fromDate: new Date(2026, 8, 10), toDate: new Date(2026, 8, 10), reason: "Nemoc", cancelLunch: true, dayPart: "FULL_DAY",
    }, [new Date(2026, 8, 10)]);
    expect(result.excuses.map((excuse) => excuse.childId)).toEqual([
      "child-1",
      "child-2",
    ]);
    expect(result.summary).toEqual({
      cancelLunch: true,
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
    mocks.createParentExcuses.mockResolvedValue([{
      ...makeExcuse("child-1"),
      fromDate: new Date(2026, 7, 19),
      toDate: new Date(2026, 7, 20),
      submittedAt: new Date(2026, 7, 18, 10),
    }]);

    const result = await submitExcuse(formData);
    if (!result.success) throw new Error(result.error);

    expect(result.summary).toEqual({
      cancelLunch: true,
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
    mocks.createParentExcuses.mockResolvedValue([{
      ...makeExcuse("child-1"),
      fromDate: new Date(2026, 7, 19),
      toDate: new Date(2026, 7, 19),
      submittedAt: new Date(2026, 7, 19, 12),
      lateApprovedAt: new Date(2026, 7, 19, 12),
    }]);

    const result = await submitExcuse(formData);
    if (!result.success) throw new Error(result.error);

    expect(result.summary).toEqual({
      cancelLunch: true,
      schoolDayCount: 1,
      lateDayCount: 0,
      onTimeDayCount: 0,
      automaticallyApprovedDayCount: 1,
    });
  });

  it("keeps lunch and requires no review when the parent declines cancellation", async () => {
    const formData = makeFormData();
    formData.delete("childIds");
    formData.append("childIds", "child-1");
    formData.set("cancelLunch", "false");
    mocks.createParentExcuses.mockResolvedValue([{
      ...makeExcuse("child-1"),
      cancelLunch: false,
      lateApprovedAt: new Date(2026, 8, 1),
    }]);

    const result = await submitExcuse(formData);
    if (!result.success) throw new Error(result.error);

    expect(mocks.createParentExcuses).toHaveBeenCalledWith(
      expect.objectContaining({ childIds: ["child-1"], cancelLunch: false }),
      [new Date(2026, 8, 10)],
    );
    expect(result.summary).toEqual({
      cancelLunch: false,
      schoolDayCount: 1,
      lateDayCount: 0,
      onTimeDayCount: 0,
      automaticallyApprovedDayCount: 1,
    });
  });

  it("stores an afternoon absence with the requested lunch cancellation", async () => {
    const formData = makeFormData();
    formData.delete("childIds");
    formData.append("childIds", "child-1");
    formData.set("dayPart", "AFTERNOON");
    formData.set("cancelLunch", "true");
    mocks.createParentExcuses.mockResolvedValue([{
      ...makeExcuse("child-1"),
      dayPart: "AFTERNOON",
      cancelLunch: true,
    }]);

    const result = await submitExcuse(formData);
    if (!result.success) throw new Error(result.error);

    expect(mocks.createParentExcuses).toHaveBeenCalledWith(
      expect.objectContaining({ childIds: ["child-1"], fromDate: new Date(2026, 8, 10), toDate: new Date(2026, 8, 10), dayPart: "AFTERNOON", cancelLunch: true }),
      [new Date(2026, 8, 10)],
    );
    expect(result.summary.cancelLunch).toBe(true);
  });

  it("forces whole day when a submitted range spans multiple dates", async () => {
    const formData = makeFormData();
    formData.delete("childIds");
    formData.append("childIds", "child-1");
    formData.set("fromDate", "2026-09-09");
    formData.set("toDate", "2026-09-10");
    formData.set("dayPart", "AFTERNOON");
    mocks.getSchoolDaysInRange.mockResolvedValue([
      new Date(2026, 8, 9),
      new Date(2026, 8, 10),
    ]);

    await submitExcuse(formData);

    expect(mocks.createParentExcuses).toHaveBeenCalledWith(
      expect.objectContaining({ childIds: ["child-1"], fromDate: new Date(2026, 8, 9), toDate: new Date(2026, 8, 10), dayPart: "FULL_DAY", cancelLunch: true }),
      [new Date(2026, 8, 9), new Date(2026, 8, 10)],
    );
  });

  it("rejects an excuse whose endpoint is a closed day", async () => {
    const formData = makeFormData();
    formData.set("fromDate", "2026-09-11");
    formData.set("toDate", "2026-09-11");
    mocks.getSchoolDaysInRange.mockResolvedValue([]);

    await expect(submitExcuse(formData)).resolves.toEqual({
      success: false,
      error: "Začátek i konec omluvenky musí být v den, kdy je Habitat otevřený.",
    });
    expect(mocks.createParentExcuses).not.toHaveBeenCalled();
  });

  it("rejects a regular day off for any selected child before saving", async () => {
    mocks.listParentLinks.mockResolvedValue([
      { child: { id: "child-1", active: true } },
      { child: { id: "child-2", active: true, attendanceDays: [1, 2, 3] } },
    ]);
    await expect(submitExcuse(makeFormData())).resolves.toEqual({
      success: false, error: "Začátek i konec omluvenky musí být v den, kdy dítě pravidelně chodí.",
    });
    expect(mocks.createParentExcuses).not.toHaveBeenCalled();
  });

  it("allows a range with a regular day off between valid attendance endpoints", async () => {
    const value = makeFormData(); value.set("fromDate", "2026-09-07"); value.set("toDate", "2026-09-09");
    mocks.listParentLinks.mockResolvedValue([1, 2].map(id => ({ child: { id: `child-${id}`, active: true, attendanceDays: [1, 3] } })));
    mocks.getSchoolDaysInRange.mockResolvedValue([7, 8, 9].map(day => new Date(2026, 8, day)));
    await expect(submitExcuse(value)).resolves.toMatchObject({ success: true });
  });

  it("allows open endpoints with closed days inside the range", async () => {
    const formData = makeFormData();
    formData.set("fromDate", "2026-09-10");
    formData.set("toDate", "2026-09-15");
    mocks.getSchoolDaysInRange.mockResolvedValue([
      new Date(2026, 8, 10),
      new Date(2026, 8, 14),
      new Date(2026, 8, 15),
    ]);

    await expect(submitExcuse(formData)).resolves.toMatchObject({
      success: true,
    });
    expect(mocks.createParentExcuses).toHaveBeenCalled();
  });

  it("rejects an invalid day part before creating anything", async () => {
    const formData = makeFormData();
    formData.set("dayPart", "EVENING");

    await expect(submitExcuse(formData)).resolves.toEqual({ success: false, error: "Neplatná část dne." });
    expect(mocks.createParentExcuses).not.toHaveBeenCalled();
  });

  it("rejects an invalid lunch choice before creating anything", async () => {
    const formData = makeFormData();
    formData.set("cancelLunch", "on");

    await expect(submitExcuse(formData)).resolves.toEqual({ success: false, error: "Neplatná volba pro odhlášení oběda." });
    expect(mocks.createParentExcuses).not.toHaveBeenCalled();
  });

  it("creates nothing when the parent lacks access to one selected child", async () => {
    mocks.canManageExcuses.mockResolvedValue(false);

    await expect(submitExcuse(makeFormData())).rejects.toThrow("Access denied");
    expect(mocks.createParentExcuses).not.toHaveBeenCalled();
  });

  it("creates nothing when no child is selected", async () => {
    const formData = makeFormData();
    formData.delete("childIds");

    await expect(submitExcuse(formData)).resolves.toEqual({ success: false, error: "Vyberte alespoň jedno dítě." });
    expect(mocks.canManageExcuses).not.toHaveBeenCalled();
    expect(mocks.createParentExcuses).not.toHaveBeenCalled();
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
        attendanceDays: [1, 2, 3, 4],
      },
    ]);
  });
});


describe("submitMakeup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDbUser.mockResolvedValue({ id: "parent-1", role: "PARENT" });
    mocks.canManageExcuses.mockResolvedValue(true);
    mocks.listParentLinks.mockResolvedValue([{ child: { id: "child-1", active: true, attendanceDays: [1, 2, 3], doesNotTakeLunch: false } }]);
    mocks.getSchoolDaysInRange.mockResolvedValue([new Date(2026, 8, 10)]);
    mocks.createParentExcuses.mockResolvedValue([{ ...makeExcuse("child-1"), kind: "MAKEUP", cancelLunch: false }]);
  });
  const form = () => {
    const value = makeFormData();
    value.delete("childIds"); value.append("childIds", "child-1");
    return value;
  };
  it("creates an arrival record rather than an absence", async () => {
    const result = await submitMakeup(form());
    if (!result.success) throw new Error(result.error);
    expect(mocks.createParentExcuses).toHaveBeenCalledWith(expect.objectContaining({ kind: "MAKEUP", cancelLunch: false }), [new Date(2026, 8, 10)]);
    expect(result.summary).toMatchObject({ schoolDayCount: 1, lateDayCount: 0, onTimeDayCount: 1 });
  });
  it("keeps late arrival valid while reporting its missing lunch", async () => {
    mocks.createParentExcuses.mockResolvedValue([{ ...makeExcuse("child-1"), kind: "MAKEUP", cancelLunch: false, submittedAt: new Date(2026, 8, 9, 10) }]);
    await expect(submitMakeup(form())).resolves.toMatchObject({ success: true, summary: { schoolDayCount: 1, lateDayCount: 1 } });
  });
  it("does not promise a lunch for an afternoon makeup", async () => {
    const value = form(); value.set("dayPart", "AFTERNOON");
    mocks.createParentExcuses.mockResolvedValue([{ ...makeExcuse("child-1"), kind: "MAKEUP", dayPart: "AFTERNOON", cancelLunch: false }]);
    await expect(submitMakeup(value)).resolves.toMatchObject({ success: true, summary: { schoolDayCount: 1, onTimeDayCount: 0, lateDayCount: 0 } });
  });
  it("counts only lunch-taking children in a mixed makeup lunch summary", async () => {
    mocks.listParentLinks.mockResolvedValue([
      { child: { id: "child-1", active: true, attendanceDays: [1, 2, 3], doesNotTakeLunch: false } },
      { child: { id: "child-2", active: true, attendanceDays: [1, 2, 3], doesNotTakeLunch: true } },
    ]);
    mocks.createParentExcuses.mockResolvedValue([1, 2].map(id => ({ ...makeExcuse(`child-${id}`), kind: "MAKEUP", cancelLunch: false })));
    await expect(submitMakeup(makeFormData())).resolves.toMatchObject({ success: true, summary: { schoolDayCount: 2, onTimeDayCount: 1 } });
  });
  it("counts only extra dates inside a range", async () => {
    const value = form(); value.set("toDate", "2026-09-17");
    mocks.getSchoolDaysInRange.mockResolvedValue([10, 14, 15, 16, 17].map(day => new Date(2026, 8, day)));
    await expect(submitMakeup(value)).resolves.toMatchObject({ success: true, summary: { schoolDayCount: 2 } });
  });
  it("rejects a makeup for a child who already attends every day", async () => {
    mocks.listParentLinks.mockResolvedValue([{ child: { id: "child-1", active: true } }]);
    await expect(submitMakeup(form())).resolves.toEqual({ success: false, error: "Náhradu lze zadat pouze dítěti, které nechodí každý den." });
    expect(mocks.createParentExcuses).not.toHaveBeenCalled();
  });
  it("rejects a range without any extra attendance day", async () => {
    mocks.listParentLinks.mockResolvedValue([{ child: { id: "child-1", active: true, attendanceDays: [4] } }]);
    await expect(submitMakeup(form())).resolves.toEqual({
      success: false,
      error: "Začátek i konec náhrady musí být v den, kdy dítě pravidelně nechodí.",
    });
    expect(mocks.createParentExcuses).not.toHaveBeenCalled();
  });
  it.each([["fromDate", "2026-09-09"], ["toDate", "2026-09-14"]])("rejects a regular attendance endpoint %s even with an extra date inside", async (field, date) => {
    const value = form(); value.set(field, date);
    mocks.getSchoolDaysInRange.mockResolvedValue([9, 10, 14].map(day => new Date(2026, 8, day)));
    await expect(submitMakeup(value)).resolves.toEqual({
      success: false, error: "Začátek i konec náhrady musí být v den, kdy dítě pravidelně nechodí.",
    });
    expect(mocks.createParentExcuses).not.toHaveBeenCalled();
  });
  it("returns safe validation for a reversed date range", async () => {
    const value = form();
    value.set("toDate", "2026-09-09");
    await expect(submitMakeup(value)).resolves.toEqual({
      success: false,
      error: "Datum konce nesmí být před datem začátku.",
    });
    expect(mocks.createParentExcuses).not.toHaveBeenCalled();
  });
  it("does not expose unexpected database failures as validation text", async () => {
    mocks.createParentExcuses.mockRejectedValueOnce(new Error("private database failure"));
    await expect(submitMakeup(form())).rejects.toThrow("private database failure");
  });
  it("rejects unauthorized children before writing", async () => {
    mocks.canManageExcuses.mockResolvedValue(false);
    await expect(submitMakeup(form())).rejects.toThrow("Access denied");
    expect(mocks.createParentExcuses).not.toHaveBeenCalled();
  });
});

describe("getChildExcuses schedule for editing", () => {
  it("returns only the child's attendance schedule alongside its records", async () => {
    mocks.getDbUser.mockResolvedValue({ id: "parent-1", role: "PARENT" });
    mocks.canSubmitExcuse.mockResolvedValue(true);
    mocks.childrenGet.mockResolvedValue({ attendanceDays: [1, 3, 4], secret: "private" });
    mocks.excusesList.mockResolvedValue([makeExcuse("child-1")]);
    await expect(getChildExcuses("child-1")).resolves.toEqual([
      expect.objectContaining({ child: { attendanceDays: [1, 3, 4] } }),
    ]);
  });
});


describe("today's regular attendance plan", () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 29, 10));
    mocks.getDbUser.mockResolvedValue({ id: "director", role: "DIRECTOR" });
    mocks.isClosedDay.mockResolvedValue(false);
    mocks.childrenGet.mockResolvedValue({ id: "child-1", attendanceDays: [1, 3, 4] });
    mocks.attendanceGet.mockResolvedValue(null);
    mocks.getExcusesOverlapping.mockResolvedValue([]);
  });
  it("identifies a regular off day", async () => {
    await expect(getChildTodayStatus("child-1")).resolves.toMatchObject({ notScheduled: true, makeup: false });
    vi.useRealTimers();
  });
  it("identifies an extra planned arrival even after the lunch deadline", async () => {
    mocks.getExcusesOverlapping.mockResolvedValue([{ ...makeExcuse("child-1"), kind: "MAKEUP", fromDate: new Date(2026, 8, 29), toDate: new Date(2026, 8, 29), submittedAt: new Date(2026, 8, 29, 9) }]);
    await expect(getChildTodayStatus("child-1")).resolves.toMatchObject({ notScheduled: false, makeup: true });
    vi.useRealTimers();
  });
});
