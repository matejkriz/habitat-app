import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getProfile: vi.fn(), getChild: vi.fn(), getSchoolDays: vi.fn(),
  createConfirmation: vi.fn(), verifyConfirmation: vi.fn(), createExcuses: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: {
  mcp: { getParentProfile: mocks.getProfile, createParentExcuses: mocks.createExcuses },
  children: { get: mocks.getChild },
} }));
vi.mock("@/lib/school-days", () => ({ getSchoolDaysInRange: mocks.getSchoolDays }));
vi.mock("./confirmation", () => ({ createExcuseConfirmation: mocks.createConfirmation, verifyExcuseConfirmation: mocks.verifyConfirmation }));
import { createMcpExcuse, previewMcpExcuse } from "./parent-excuses";

const input = { childIds: ["child"], fromDate: "2026-09-15", toDate: "2026-09-16" };
const child = { id: "child", firstName: "Anna", gender: "FEMALE" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getProfile.mockResolvedValue({ userId: "parent", children: [child] });
  mocks.getChild.mockResolvedValue({ ...child, attendanceStartDate: "2026-09-16" });
  mocks.getSchoolDays.mockResolvedValue([]);
  mocks.createConfirmation.mockResolvedValue({ token: "confirmation", expiresAt: "2026-09-14T12:00:00Z" });
  mocks.verifyConfirmation.mockResolvedValue({ ...input, jti: "request", reason: null });
  mocks.createExcuses.mockResolvedValue({ replayed: true, submittedAt: 0, excuses: [] });
});

describe("MCP attendance start", () => {
  it("rejects a pre-start preview before creating a confirmation", async () => {
    await expect(previewMcpExcuse("workos-parent", input)).rejects.toMatchObject({ code: "INVALID_DATES", message: "Dítě ještě nenastoupilo do Habitatu." });
    expect(mocks.createConfirmation).not.toHaveBeenCalled();
  });

  it("checks again if a confirmation is submitted after the start date changed", async () => {
    await expect(createMcpExcuse("workos-parent", "confirmation")).rejects.toMatchObject({ code: "INVALID_DATES", message: "Dítě ještě nenastoupilo do Habitatu." });
    expect(mocks.createExcuses).not.toHaveBeenCalled();
  });

  it("allows the start date without adding child details to the preview", async () => {
    const result = await previewMcpExcuse("workos-parent", { ...input, fromDate: "2026-09-16" });
    expect(result.children).toEqual([child]);
    expect(result.children[0]).not.toHaveProperty("attendanceStartDate");
    expect(mocks.createConfirmation).toHaveBeenCalledOnce();
  });
});
