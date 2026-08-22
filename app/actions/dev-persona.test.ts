import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const withAuth = vi.fn();
const setCookie = vi.fn();
const revalidatePath = vi.fn();

vi.mock("@workos-inc/authkit-nextjs", () => ({ withAuth }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: setCookie })),
}));
vi.mock("next/cache", () => ({ revalidatePath }));

type SwitchDevPersona = (personaId: string) => Promise<void>;

async function loadAction(): Promise<SwitchDevPersona | undefined> {
  const modulePath = "./dev-persona";
  const actionModule = await import(modulePath).catch(() => undefined);

  return actionModule?.switchDevPersona;
}

describe("switchDevPersona", () => {
  beforeEach(() => {
    vi.stubEnv("DEV_PERSONA_SWITCHER", "true");
    vi.stubEnv("WORKOS_API_KEY", "sk_test_example");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_TARGET_ENV", "preview");
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", "develop");
    withAuth.mockResolvedValue({
      user: {
        id: "user_developer",
        email: "dev@habitatzbraslav.cz",
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("sets an HttpOnly cookie for an allowed persona", async () => {
    const switchDevPersona = await loadAction();

    expect(switchDevPersona).toBeTypeOf("function");
    if (!switchDevPersona) return;
    await switchDevPersona("seed-user-teacher-kveta");
    expect(setCookie).toHaveBeenCalledWith(
      "habitat_dev_persona",
      "seed-user-teacher-kveta",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "strict",
        secure: true,
        path: "/",
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("rejects production even when the feature flag is set", async () => {
    vi.stubEnv("VERCEL_TARGET_ENV", "production");
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", "main");
    const switchDevPersona = await loadAction();

    expect(switchDevPersona).toBeTypeOf("function");
    if (!switchDevPersona) return;
    await expect(
      switchDevPersona("seed-user-director-bohumil"),
    ).rejects.toThrow("Development persona switching is not available");
    expect(setCookie).not.toHaveBeenCalled();
  });

  it("rejects another authenticated email and unknown persona IDs", async () => {
    const switchDevPersona = await loadAction();
    expect(switchDevPersona).toBeTypeOf("function");
    if (!switchDevPersona) return;
    withAuth.mockResolvedValueOnce({
      user: {
        id: "user_other",
        email: "nekdo@habitatzbraslav.cz",
      },
    });

    await expect(
      switchDevPersona("seed-user-director-bohumil"),
    ).rejects.toThrow("Development persona switching is not available");
    await expect(switchDevPersona("arbitrary-user-id")).rejects.toThrow(
      "Unknown development persona",
    );
    expect(setCookie).not.toHaveBeenCalled();
  });
});
