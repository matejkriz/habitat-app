import { beforeEach, describe, expect, it, vi } from "vitest";

const handleAuth = vi.fn((options: unknown) => options);

vi.mock("@workos-inc/authkit-nextjs", () => ({ handleAuth }));
vi.mock("@/lib/workos-url", () => ({
  getWorkOSBaseUrl: () => "https://developapp.habitatzbraslav.cz",
}));

describe("callback route", () => {
  beforeEach(() => {
    vi.resetModules();
    handleAuth.mockClear();
  });

  it("restarts sign-in when the PKCE cookie is missing", async () => {
    await import("./route");

    const options = handleAuth.mock.calls[0]?.[0] as {
      onError?: (input: { error: unknown; request: Request }) => Promise<Response> | Response;
    };

    expect(options.onError).toBeTypeOf("function");

    const response = await options.onError?.({
      error: { code: "missing_pkce_cookie" },
      request: new Request("https://developapp.habitatzbraslav.cz/callback?code=stale"),
    });

    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toBe(
      "https://developapp.habitatzbraslav.cz/login",
    );
  });
});
