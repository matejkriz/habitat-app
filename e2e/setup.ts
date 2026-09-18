import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

type SetupEnvironment = {
  [key: string]: string | undefined;
  E2E_AUTH_FILE?: string;
  E2E_BASE_URL?: string;
  E2E_DATE?: string;
  E2E_LOCAL?: string;
  E2E_TEST_DATABASE?: string;
};

export function validateE2EEnvironment(
  environment: SetupEnvironment,
  authFileExists: boolean,
) {
  if (
    !environment.E2E_BASE_URL ||
    environment.E2E_TEST_DATABASE !== "true"
  ) {
    throw new Error(
      "Set E2E_BASE_URL and E2E_TEST_DATABASE=true for an isolated, seeded test deployment. These tests write data.",
    );
  }

  if (environment.E2E_LOCAL === "true") {
    const hostname = new URL(environment.E2E_BASE_URL).hostname;
    if (!["127.0.0.1", "localhost", "[::1]"].includes(hostname)) {
      throw new Error("Local E2E tests must use a loopback application URL.");
    }
  } else if (!authFileExists) {
    throw new Error(
      "Save a WorkOS developer session first; see docs/testing.md.",
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(environment.E2E_DATE ?? "")) {
    throw new Error(
      "Set E2E_DATE to a past open school day in the test database.",
    );
  }
}

async function saveLocalWorkOSSession(baseURL: string, authFile: string) {
  const { chromium } = await import("@playwright/test");
  mkdirSync(dirname(authFile), { recursive: true });
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(new URL("/login", baseURL).toString());
    await page.getByLabel("Email", { exact: true }).fill(
      "dev@habitatzbraslav.cz",
    );
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page
      .getByRole("combobox", { name: "Testovací identita" })
      .waitFor({ state: "visible" });
    await context.storageState({ path: authFile });
  } finally {
    await browser.close();
  }
}

export default async function setup() {
  const authFile = process.env.E2E_AUTH_FILE ?? ".playwright/auth.json";
  validateE2EEnvironment(process.env, existsSync(authFile));

  if (process.env.E2E_LOCAL === "true") {
    await saveLocalWorkOSSession(process.env.E2E_BASE_URL!, authFile);
  }
}
