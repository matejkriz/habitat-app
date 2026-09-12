import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/version", () => {
  it("returns the uncached identity of the deployed build", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_VERSION", "2026.09.06");
    vi.stubEnv(
      "NEXT_PUBLIC_APP_COMMIT_SHA",
      "0123456789abcdef0123456789abcdef01234567",
    );

    const response = await GET();

    expect(await response.json()).toEqual({
      version: "2026.09.06",
      commitSha: "0123456789abcdef0123456789abcdef01234567",
    });
    expect(response.headers.get("cache-control")).toBe(
      "no-store, no-cache, max-age=0, must-revalidate",
    );
  });
});
