import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("login route", () => {
  it("uses WorkOS route handlers for sign-in and callback", () => {
    const loginRoute = resolve(process.cwd(), "app/login/route.ts");
    const callbackRoute = resolve(process.cwd(), "app/callback/route.ts");
    const clerkPage = resolve(
      process.cwd(),
      "app/(auth)/login/[[...rest]]/page.tsx",
    );

    expect(existsSync(loginRoute)).toBe(true);
    expect(existsSync(callbackRoute)).toBe(true);
    expect(existsSync(clerkPage)).toBe(false);
  });
});
