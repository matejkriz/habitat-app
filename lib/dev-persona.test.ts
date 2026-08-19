import { describe, expect, it } from "vitest";
import * as policy from "./dev-persona";

type PersonaEnvironment = {
  DEV_PERSONA_SWITCHER?: string;
  CLERK_SECRET_KEY?: string;
  NODE_ENV?: string;
  VERCEL_TARGET_ENV?: string;
  VERCEL_GIT_COMMIT_REF?: string;
};

const allow = policy.isDevPersonaModeAllowed as (
  environment: PersonaEnvironment,
) => boolean;

describe("development persona policy", () => {
  it("allows local development and the develop preview with Clerk test keys", () => {
    const shared = {
      DEV_PERSONA_SWITCHER: "true",
      CLERK_SECRET_KEY: "sk_test_example",
    };

    expect(allow({ ...shared, NODE_ENV: "development" })).toBe(true);
    expect(
      allow({
        ...shared,
        NODE_ENV: "production",
        VERCEL_TARGET_ENV: "preview",
        VERCEL_GIT_COMMIT_REF: "develop",
      }),
    ).toBe(true);
  });

  it("fails closed outside the explicitly allowed development environments", () => {
    const shared = {
      DEV_PERSONA_SWITCHER: "true",
      CLERK_SECRET_KEY: "sk_test_example",
      NODE_ENV: "production",
    };

    expect(
      allow({
        ...shared,
        VERCEL_TARGET_ENV: "production",
        VERCEL_GIT_COMMIT_REF: "main",
      }),
    ).toBe(false);
    expect(
      allow({
        ...shared,
        VERCEL_TARGET_ENV: "preview",
        VERCEL_GIT_COMMIT_REF: "feature/anything",
      }),
    ).toBe(false);
    expect(
      allow({
        ...shared,
        CLERK_SECRET_KEY: "sk_live_example",
        VERCEL_TARGET_ENV: "preview",
        VERCEL_GIT_COMMIT_REF: "develop",
      }),
    ).toBe(false);
    expect(
      allow({
        ...shared,
        DEV_PERSONA_SWITCHER: undefined,
        VERCEL_TARGET_ENV: "preview",
        VERCEL_GIT_COMMIT_REF: "develop",
      }),
    ).toBe(false);
  });

  it("authorizes only the requested developer email", () => {
    const policyModule = policy as typeof policy & {
      DEV_PERSONA_EMAIL?: string;
      isDevPersonaEmail?: (email: string | null | undefined) => boolean;
    };

    expect(policyModule.DEV_PERSONA_EMAIL).toBe("dev@habitatzbraslav.cz");
    expect(policyModule.isDevPersonaEmail?.("DEV@HABITATZBRASLAV.CZ")).toBe(true);
    expect(policyModule.isDevPersonaEmail?.("nekdo@habitatzbraslav.cz")).toBe(false);
  });

  it("accepts only the fixed seed personas", () => {
    const policyModule = policy as typeof policy & {
      DEV_PERSONAS?: ReadonlyArray<{ id: string; role: string }>;
      isDevPersonaId?: (value: string) => boolean;
    };

    expect(policyModule.DEV_PERSONAS).toHaveLength(6);
    expect(policyModule.isDevPersonaId?.("seed-user-parent-roza")).toBe(true);
    expect(policyModule.isDevPersonaId?.("arbitrary-user-id")).toBe(false);
  });

  it("falls back to the director persona for missing or tampered cookies", () => {
    const resolveDevPersonaId = (
      policy as typeof policy & {
        resolveDevPersonaId?: (value: string | undefined) => string;
      }
    ).resolveDevPersonaId;

    expect(resolveDevPersonaId).toBeTypeOf("function");
    expect(resolveDevPersonaId?.(undefined)).toBe(
      "seed-user-director-bohumil",
    );
    expect(resolveDevPersonaId?.("arbitrary-user-id")).toBe(
      "seed-user-director-bohumil",
    );
    expect(resolveDevPersonaId?.("seed-user-teacher-kveta")).toBe(
      "seed-user-teacher-kveta",
    );
  });
});
