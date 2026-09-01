import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createExcuseConfirmation, verifyExcuseConfirmation } from "./confirmation";

describe("MCP excuse confirmation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T08:00:00.000Z"));
    vi.stubEnv("MCP_RESOURCE_URL", "https://develop.example.cz/api/mcp");
    vi.stubEnv("MCP_CONFIRMATION_SECRET", "a-secure-test-secret-with-32-characters");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("binds the exact preview to the authenticated parent", async () => {
    const { token } = await createExcuseConfirmation({
      workosUserId: "user_123",
      childIds: ["child-1"],
      fromDate: "2026-09-02",
      toDate: "2026-09-03",
      reason: "Nemoc",
    });

    await expect(verifyExcuseConfirmation(token, "user_123")).resolves.toMatchObject({
      sub: "user_123",
      childIds: ["child-1"],
      fromDate: "2026-09-02",
      toDate: "2026-09-03",
      reason: "Nemoc",
    });
    await expect(verifyExcuseConfirmation(token, "user_456")).rejects.toThrow();
  });

  it("expires after ten minutes", async () => {
    const { token } = await createExcuseConfirmation({
      workosUserId: "user_123",
      childIds: ["child-1"],
      fromDate: "2026-09-02",
      toDate: "2026-09-02",
      reason: null,
    });
    vi.advanceTimersByTime(11 * 60 * 1000);
    await expect(verifyExcuseConfirmation(token, "user_123")).rejects.toThrow();
  });
});
