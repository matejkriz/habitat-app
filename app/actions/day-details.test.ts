import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), get: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getDbUser: mocks.user }));
vi.mock("@/lib/db", () => ({ db: { dayDetails: { get: mocks.get, save: mocks.save } } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { getDayDetailsForDate, saveDayDetails } from "./day-details";

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
});
