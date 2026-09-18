import { describe, expect, it } from "vitest";
import * as setupModule from "../e2e/setup";

type SetupEnvironment = {
  E2E_AUTH_FILE?: string;
  E2E_BASE_URL?: string;
  E2E_DATE?: string;
  E2E_LOCAL?: string;
  E2E_TEST_DATABASE?: string;
};

const validate = (
  setupModule as typeof setupModule & {
    validateE2EEnvironment?: (
      environment: SetupEnvironment,
      authFileExists: boolean,
    ) => void;
  }
).validateE2EEnvironment;

describe("Playwright environment guard", () => {
  const shared = {
    E2E_BASE_URL: "http://127.0.0.1:3000",
    E2E_DATE: "2026-09-15",
    E2E_TEST_DATABASE: "true",
  };

  it("lets the local runner create its WorkOS session automatically", () => {
    expect(validate).toBeTypeOf("function");
    expect(() =>
      validate?.({ ...shared, E2E_LOCAL: "true" }, false),
    ).not.toThrow();
  });

  it("still requires a pre-saved session for an external test deployment", () => {
    expect(() => validate?.(shared, false)).toThrow(
      "Save a WorkOS developer session",
    );
    expect(() => validate?.(shared, true)).not.toThrow();
  });

  it("refuses local mode against a non-loopback application URL", () => {
    expect(() =>
      validate?.(
        {
          ...shared,
          E2E_BASE_URL: "https://preview.example.com",
          E2E_LOCAL: "true",
        },
        false,
      ),
    ).toThrow("loopback");
  });
});
