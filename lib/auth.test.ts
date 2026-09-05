import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const request = { id: 0 };

  return {
    withAuth: vi.fn(),
    cookies: vi.fn(),
    userGet: vi.fn(),
    userCreate: vi.fn(),
    userUpdate: vi.fn(),
    startRequest: () => {
      request.id += 1;
    },
    cache: vi.fn(
      <Arguments extends unknown[], Result>(
        operation: (...args: Arguments) => Result,
      ) => {
        let cachedRequestId = -1;
        let cachedResult: Result;

        return (...args: Arguments): Result => {
          if (cachedRequestId !== request.id) {
            cachedRequestId = request.id;
            cachedResult = operation(...args);
          }
          return cachedResult;
        };
      },
    ),
  };
});

vi.mock("@workos-inc/authkit-nextjs", () => ({
  withAuth: mocks.withAuth,
}));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("react", () => ({ cache: mocks.cache }));
vi.mock("./db", () => ({
  db: {
    users: {
      get: mocks.userGet,
      create: mocks.userCreate,
      update: mocks.userUpdate,
    },
  },
}));

import { getDbUser } from "./auth";

const personaUser = {
  id: "seed-user-teacher-kveta",
  workosId: "seed:teacher-kveta",
  name: "Květa Křída",
  email: "krizmate+ucitel-kveta-krida@gmail.com",
  image: null,
  role: "TEACHER" as const,
};

describe("getDbUser development personas", () => {
  beforeEach(() => {
    mocks.startRequest();
    vi.stubEnv("DEV_PERSONA_SWITCHER", "true");
    vi.stubEnv("WORKOS_API_KEY", "sk_test_example");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_TARGET_ENV", "preview");
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", "develop");
    mocks.withAuth.mockResolvedValue({
      user: {
        id: "user_developer",
        email: "dev@habitatzbraslav.cz",
        name: "Developer",
        firstName: "Dev",
        lastName: "Eloper",
        profilePictureUrl: null,
      },
    });
    mocks.cookies.mockResolvedValue({
      get: vi.fn(() => ({ value: "seed-user-teacher-kveta" })),
    });
    mocks.userGet.mockImplementation(async ({ where }) =>
      where.id === personaUser.id ? personaUser : null,
    );
    mocks.userCreate.mockResolvedValue({
      ...personaUser,
      id: "ordinary-user",
      workosId: "user_developer",
      email: "dev@habitatzbraslav.cz",
      role: "PARENT",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("returns the selected seed persona for the authorized developer", async () => {
    await expect(getDbUser()).resolves.toMatchObject({
      id: personaUser.id,
      role: "TEACHER",
      devPersonaId: personaUser.id,
    });
    expect(mocks.userGet).toHaveBeenCalledWith({
      where: { id: personaUser.id },
    });
  });

  it("uses the ordinary WorkOS identity in production", async () => {
    vi.stubEnv("VERCEL_TARGET_ENV", "production");
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", "main");
    const productionUser = {
      ...personaUser,
      id: "production-user",
      workosId: "user_developer",
      role: "DIRECTOR" as const,
    };
    mocks.userGet.mockImplementation(async ({ where }) =>
      where.workosId === "user_developer" ? productionUser : null,
    );

    await expect(getDbUser()).resolves.toMatchObject({
      id: "production-user",
      role: "DIRECTOR",
    });
    expect(mocks.cookies).not.toHaveBeenCalled();
  });

  it("deduplicates authentication and user lookup within one request", async () => {
    vi.stubEnv("VERCEL_TARGET_ENV", "production");
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", "main");
    mocks.userGet.mockResolvedValue({
      ...personaUser,
      id: "production-user",
      workosId: "user_developer",
      role: "DIRECTOR",
    });

    const [first, second] = await Promise.all([getDbUser(), getDbUser()]);

    expect(first).toBe(second);
    expect(mocks.withAuth).toHaveBeenCalledTimes(1);
    expect(mocks.userGet).toHaveBeenCalledTimes(1);
  });

  it("links a prefilled user by email on first WorkOS sign-in", async () => {
    vi.stubEnv("VERCEL_TARGET_ENV", "production");
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", "main");
    const prefilledUser = {
      ...personaUser,
      id: "prefilled-parent",
      workosId: "seed:parent-roza",
      email: "parent@example.test",
      role: "PARENT" as const,
    };
    const linkedUser = {
      ...prefilledUser,
      workosId: "user_workos",
      name: "Rodič Z WorkOS",
      image: "https://images.example.test/avatar.png",
    };
    mocks.withAuth.mockResolvedValueOnce({
      user: {
        id: "user_workos",
        email: "parent@example.test",
        name: "Rodič Z WorkOS",
        firstName: "Rodič",
        lastName: "Z WorkOS",
        profilePictureUrl: "https://images.example.test/avatar.png",
      },
    });
    mocks.userGet.mockImplementation(async ({ where }) => {
      if (where.workosId === "user_workos") return null;
      if (where.email === "parent@example.test") return prefilledUser;
      return null;
    });
    mocks.userUpdate.mockResolvedValue(linkedUser);

    await expect(getDbUser()).resolves.toMatchObject({
      id: "prefilled-parent",
      workosId: "user_workos",
      role: "PARENT",
    });
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "prefilled-parent" },
      data: {
        workosId: "user_workos",
        name: "Rodič Z WorkOS",
        image: "https://images.example.test/avatar.png",
      },
    });
    expect(mocks.userCreate).not.toHaveBeenCalled();
  });

  it("does not preserve a profile image from a retired identity provider", async () => {
    vi.stubEnv("VERCEL_TARGET_ENV", "production");
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", "main");
    const prefilledUser = {
      ...personaUser,
      id: "prefilled-parent",
      workosId: "seed:parent-roza",
      email: "parent@example.test",
      image: "https://legacy-idp.example.test/avatar.png",
      role: "PARENT" as const,
    };
    mocks.withAuth.mockResolvedValueOnce({
      user: {
        id: "user_workos",
        email: "parent@example.test",
        name: "Rodič Z WorkOS",
        firstName: "Rodič",
        lastName: "Z WorkOS",
        profilePictureUrl: null,
      },
    });
    mocks.userGet.mockImplementation(async ({ where }) => {
      if (where.workosId === "user_workos") return null;
      if (where.email === "parent@example.test") return prefilledUser;
      return null;
    });
    mocks.userUpdate.mockResolvedValue({
      ...prefilledUser,
      workosId: "user_workos",
      image: null,
    });

    await getDbUser();

    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "prefilled-parent" },
      data: {
        workosId: "user_workos",
        name: "Rodič Z WorkOS",
        image: null,
      },
    });
  });
});
