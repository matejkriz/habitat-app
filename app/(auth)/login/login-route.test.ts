import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("login route", () => {
  it("uses an optional catch-all route for Clerk path routing", () => {
    const catchAllPage = resolve(
      process.cwd(),
      "app/(auth)/login/[[...rest]]/page.tsx",
    );
    const singlePage = resolve(process.cwd(), "app/(auth)/login/page.tsx");

    expect(existsSync(catchAllPage)).toBe(true);
    expect(existsSync(singlePage)).toBe(false);
  });
});
