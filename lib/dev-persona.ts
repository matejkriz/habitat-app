import type { UserRole } from "./types";

export const DEV_PERSONA_EMAIL = "dev@habitatzbraslav.cz";
export const DEV_PERSONA_COOKIE = "habitat_dev_persona";

export interface DevPersona {
  id: string;
  label: string;
  role: UserRole;
  homePath: string;
}

export const DEV_PERSONAS = [
  {
    id: "seed-user-parent-roza",
    label: "Róza Rohlíková",
    role: "PARENT",
    homePath: "/rodic",
  },
  {
    id: "seed-user-parent-bedrich",
    label: "Bedřich Bábovka",
    role: "PARENT",
    homePath: "/rodic",
  },
  {
    id: "seed-user-parent-vera",
    label: "Věra Vrtulová",
    role: "PARENT",
    homePath: "/rodic",
  },
  {
    id: "seed-user-teacher-kveta",
    label: "Květa Křída",
    role: "TEACHER",
    homePath: "/ucitel/dochazka",
  },
  {
    id: "seed-user-teacher-hugo",
    label: "Hugo Hvízd",
    role: "TEACHER",
    homePath: "/ucitel/dochazka",
  },
  {
    id: "seed-user-director-bohumil",
    label: "Bohumil Boss",
    role: "DIRECTOR",
    homePath: "/reditel",
  },
] as const satisfies readonly DevPersona[];

export type DevPersonaId = (typeof DEV_PERSONAS)[number]["id"];

export const DEFAULT_DEV_PERSONA_ID: DevPersonaId =
  "seed-user-director-bohumil";

export interface DevPersonaEnvironment {
  DEV_PERSONA_SWITCHER?: string;
  CLERK_SECRET_KEY?: string;
  NODE_ENV?: string;
  VERCEL_TARGET_ENV?: string;
  VERCEL_GIT_COMMIT_REF?: string;
}

export function isDevPersonaModeAllowed(
  environment: DevPersonaEnvironment = process.env,
): boolean {
  if (environment.VERCEL_TARGET_ENV === "production") {
    return false;
  }

  if (
    environment.DEV_PERSONA_SWITCHER !== "true" ||
    !environment.CLERK_SECRET_KEY?.startsWith("sk_test_")
  ) {
    return false;
  }

  const isLocalDevelopment =
    environment.NODE_ENV === "development" &&
    environment.VERCEL_TARGET_ENV === undefined;
  const isDevelopPreview =
    environment.VERCEL_TARGET_ENV === "preview" &&
    environment.VERCEL_GIT_COMMIT_REF === "develop";

  return isLocalDevelopment || isDevelopPreview;
}

export function isDevPersonaEmail(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === DEV_PERSONA_EMAIL;
}

export function isDevPersonaId(value: string): value is DevPersonaId {
  return DEV_PERSONAS.some((persona) => persona.id === value);
}

export function resolveDevPersonaId(value: string | undefined): DevPersonaId {
  return value && isDevPersonaId(value) ? value : DEFAULT_DEV_PERSONA_ID;
}

export function getDevPersona(personaId: DevPersonaId): DevPersona {
  return DEV_PERSONAS.find((persona) => persona.id === personaId)!;
}
