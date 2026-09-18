import { existsSync } from "node:fs";

export default function setup() {
  if (!process.env.E2E_BASE_URL || process.env.E2E_TEST_DATABASE !== "true") {
    throw new Error(
      "Set E2E_BASE_URL and E2E_TEST_DATABASE=true for an isolated, seeded test deployment. These tests write data.",
    );
  }
  if (!existsSync(process.env.E2E_AUTH_FILE ?? ".playwright/auth.json")) {
    throw new Error(
      "Save a WorkOS developer session first; see docs/testing.md.",
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(process.env.E2E_DATE ?? "")) {
    throw new Error(
      "Set E2E_DATE to a past open school day in the test database.",
    );
  }
}
