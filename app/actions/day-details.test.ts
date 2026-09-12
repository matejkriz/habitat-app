import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), reports: vi.fn(), createExpense: vi.fn(), get: vi.fn(), save: vi.fn(), listExpenses: vi.fn(), setExpense: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getDbUser: mocks.user }));
vi.mock("@/lib/db", () => ({ db: { tripFunds: { createExpense: mocks.createExpense }, dayDetails: { reports: mocks.reports, get: mocks.get, save: mocks.save }, childTripExpenses: { list: mocks.listExpenses, set: mocks.setExpense } } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { getDayReport, saveDayReport, getDayReports, createTripExpense, getDayDetailsForDate, saveDayDetails, getDayTripExpenses, setChildTripExpense } from "./day-details";

describe("day detail access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.mockResolvedValue({ id: "director", role: "DIRECTOR" });
    mocks.get.mockResolvedValue({ name: "Jarmark", expense: 100, report: "Soukromé poznámky" });
  });
  it("only sends the name to teachers", async () => {
    mocks.user.mockResolvedValue({ role: "TEACHER" });
    expect(await getDayDetailsForDate("2026-09-10")).toEqual({ name: "Jarmark" });
    expect(mocks.get).toHaveBeenCalledWith(new Date(2026, 8, 10), false);
  });
  it("sends all details to the director", async () => {
    expect(await getDayDetailsForDate("2026-09-10")).toEqual({ name: "Jarmark", expense: 100, report: "Soukromé poznámky" });
  });
  it.each(["TEACHER", "PARENT", null])("rejects writes by %s", async role => {
    mocks.user.mockResolvedValue(role ? { role } : null);
    await expect(saveDayDetails("2026-09-10", { name: "Změna" })).rejects.toThrow("Unauthorized");
    await expect(createTripExpense("2026-09-10", 100, [])).rejects.toThrow("Unauthorized");
    expect(mocks.createExpense).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("rejects parents reading details and invalid dates before database access", async () => {
    await expect(getDayDetailsForDate("2026-02-30")).rejects.toThrow("Neplatné datum");
    await expect(saveDayDetails("2026-09-10", { expense: 1.1 })).rejects.toThrow();
    mocks.user.mockResolvedValue({ role: "PARENT" });
    await expect(getDayDetailsForDate("2026-09-10")).rejects.toThrow("Unauthorized");
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("keeps omitted fields untouched", async () => {
    await saveDayDetails("2026-09-10", { name: "Zoo", expense: null });
    expect(mocks.save).toHaveBeenCalledWith(new Date(2026, 8, 10), { name: "Zoo", expense: null }, "director");
  });
  it.each(["TEACHER", "PARENT", null])("hides individual expenses from %s", async role => {
    mocks.user.mockResolvedValue(role ? { role } : null);
    await expect(getDayTripExpenses("2026-09-10")).rejects.toThrow("Unauthorized");
    await expect(setChildTripExpense("2026-09-10", "child", 50)).rejects.toThrow("Unauthorized");
    expect(mocks.setExpense).not.toHaveBeenCalled();
    expect(mocks.listExpenses).not.toHaveBeenCalled();
  });
  it("validates and stores individual expenses for directors", async () => {
    await expect(setChildTripExpense("2026-09-10", "child", -5)).rejects.toThrow();
    await setChildTripExpense("2026-09-10", "child", 0);
    expect(mocks.setExpense).toHaveBeenCalledWith(new Date(2026, 8, 10), "child", 0, "director");
  });

  it("validates trip creation before making one database write", async () => {
    await expect(createTripExpense("2026-02-30", 100, [])).rejects.toThrow();
    await expect(createTripExpense("2026-09-10", -1, [])).rejects.toThrow();
    await expect(createTripExpense("2026-09-10", 100, [{ childId: "child", amount: 0.5 }])).rejects.toThrow();
    expect(mocks.createExpense).not.toHaveBeenCalled();
    await createTripExpense("2026-09-10", 100, [{ childId: "child", amount: 0 }]);
    expect(mocks.createExpense).toHaveBeenCalledWith(new Date(2026, 8, 10), 100, [{ childId: "child", amount: 0 }], "director");
  });

});

describe("report feed access", () => {
  it.each(["PARENT", "DIRECTOR", "TEACHER"])("allows %s to read reports", async role => {
    mocks.user.mockResolvedValue({ role });
    mocks.reports.mockResolvedValue({ reports: [], nextBefore: null });
    expect(await getDayReports(123)).toEqual({ reports: [], nextBefore: null });
    expect(mocks.reports).toHaveBeenCalledWith(123);
  });
  it.each(["OTHER", null])("rejects %s", async role => {
    mocks.user.mockResolvedValue(role ? { role } : null);
    await expect(getDayReports()).rejects.toThrow("Unauthorized");
  });
});

describe("report editing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.mockResolvedValue({ id: "teacher", role: "TEACHER" });
    mocks.get.mockResolvedValue({ name: "Výlet", expense: 100, report: "Stávající report" });
  });
  it.each(["TEACHER", "DIRECTOR"])("allows %s to read and save only the report", async role => {
    mocks.user.mockResolvedValue({ id: "author", role });
    expect(await getDayReport("2026-09-10")).toBe("Stávající report");
    await saveDayReport("2026-09-10", "Nový text");
    expect(mocks.save).toHaveBeenCalledWith(new Date(2026, 8, 10), { report: "Nový text" }, "author");
  });
  it.each(["PARENT", null])("rejects report edits by %s", async role => {
    mocks.user.mockResolvedValue(role ? { role } : null);
    await expect(getDayReport("2026-09-10")).rejects.toThrow("Unauthorized");
    await expect(saveDayReport("2026-09-10", "Text")).rejects.toThrow("Unauthorized");
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("rejects invalid dates, empty text and oversized reports", async () => {
    await expect(saveDayReport("2026-02-30", "Text")).rejects.toThrow();
    await expect(saveDayReport("2026-09-10", "  ")).rejects.toThrow();
    await expect(saveDayReport("2026-09-10", "ž".repeat(470000))).rejects.toThrow();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
