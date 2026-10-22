import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const handleAuth = vi.fn((options: unknown) => options);
const enqueueUnassignedParentLogin = vi.fn();

vi.mock("@workos-inc/authkit-nextjs", () => ({ handleAuth }));
vi.mock("@/lib/workos-url", () => ({
  getWorkOSBaseUrl: () => "https://developapp.habitatzbraslav.cz",
}));
vi.mock("@/lib/db", () => ({
  db: { notifications: { enqueueUnassignedParentLogin } },
}));

function loginData(sessionId: unknown = "session_123") {
  const payload = Buffer.from(JSON.stringify({ sid: sessionId })).toString("base64url");
  return {
    user: { id: "user_123", email: "parent@example.test" },
    accessToken: `eyJhbGciOiJSUzI1NiJ9.${payload}.signature`,
    refreshToken: "private-refresh-token",
  };
}

async function getSuccessHandler() {
  await import("./route");
  const options = handleAuth.mock.calls[0]?.[0] as {
    onSuccess: (data: ReturnType<typeof loginData>) => Promise<void>;
  };
  expect(options.onSuccess).toBeTypeOf("function");
  return options.onSuccess;
}

describe("callback route", () => {
  beforeEach(() => {
    vi.resetModules();
    handleAuth.mockClear();
    enqueueUnassignedParentLogin.mockReset().mockResolvedValue(null);
    vi.stubEnv("VERCEL_TARGET_ENV", "production");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("checks a successful sign-in using the WorkOS identity and session", async () => {
    const onSuccess = await getSuccessHandler();

    await onSuccess(loginData());

    expect(enqueueUnassignedParentLogin).toHaveBeenCalledExactlyOnceWith({
      workosUserId: "user_123",
      email: "parent@example.test",
      loginId: "session_123",
    });
  });

  it("keeps sign-in successful when notification enqueueing fails", async () => {
    const error = new Error("Convex unavailable");
    enqueueUnassignedParentLogin.mockRejectedValueOnce(error);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const onSuccess = await getSuccessHandler();

    await expect(onSuccess(loginData())).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(
      "Failed to enqueue unassigned parent login notification:",
      error,
    );
  });

  it.each(["", null, 123])(
    "does not enqueue without a valid session ID (%s)",
    async (sessionId) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const onSuccess = await getSuccessHandler();

      await expect(onSuccess(loginData(sessionId))).resolves.toBeUndefined();

      expect(enqueueUnassignedParentLogin).not.toHaveBeenCalled();
    },
  );

  it("keeps sign-in successful when the session token cannot be decoded", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onSuccess = await getSuccessHandler();
    const data = { ...loginData(), accessToken: "invalid-token" };

    await expect(onSuccess(data)).resolves.toBeUndefined();

    expect(enqueueUnassignedParentLogin).not.toHaveBeenCalled();
  });

  it("skips the development persona account in develop preview", async () => {
    vi.stubEnv("DEV_PERSONA_SWITCHER", "true");
    vi.stubEnv("WORKOS_API_KEY", "sk_test_example");
    vi.stubEnv("VERCEL_TARGET_ENV", "preview");
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", "develop");
    const onSuccess = await getSuccessHandler();
    const data = loginData();
    data.user.email = "dev@habitatzbraslav.cz";

    await onSuccess(data);

    expect(enqueueUnassignedParentLogin).not.toHaveBeenCalled();
  });

  it("checks the development email as an ordinary account in production", async () => {
    const onSuccess = await getSuccessHandler();
    const data = loginData();
    data.user.email = "dev@habitatzbraslav.cz";

    await onSuccess(data);

    expect(enqueueUnassignedParentLogin).toHaveBeenCalledWith({
      workosUserId: "user_123",
      email: "dev@habitatzbraslav.cz",
      loginId: "session_123",
    });
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
