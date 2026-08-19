import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  cookies: vi.fn(),
  userGet: vi.fn(),
  userCreate: vi.fn(),
  userUpdate: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.auth,
  currentUser: mocks.currentUser,
}));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
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
  clerkId: "seed:teacher-kveta",
  name: "Květa Křída",
  email: "krizmate+ucitel-kveta-krida@gmail.com",
  image: null,
  role: "TEACHER" as const,
};

describe("getDbUser development personas", () => {
  beforeEach(() => {
    vi.stubEnv("DEV_PERSONA_SWITCHER", "true");
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_example");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_TARGET_ENV", "preview");
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", "develop");
    mocks.auth.mockResolvedValue({ userId: "user_developer" });
    mocks.currentUser.mockResolvedValue({
      emailAddresses: [{ emailAddress: "dev@habitatzbraslav.cz" }],
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
      clerkId: "user_developer",
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

  it("uses the ordinary Clerk identity in production", async () => {
    vi.stubEnv("VERCEL_TARGET_ENV", "production");
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", "main");
    const productionUser = {
      ...personaUser,
      id: "production-user",
      clerkId: "user_developer",
      role: "DIRECTOR" as const,
    };
    mocks.userGet.mockImplementation(async ({ where }) =>
      where.clerkId === "user_developer" ? productionUser : null,
    );

    await expect(getDbUser()).resolves.toMatchObject({
      id: "production-user",
      role: "DIRECTOR",
    });
    expect(mocks.cookies).not.toHaveBeenCalled();
  });
});
