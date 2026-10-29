import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const secret = "test-user-lookup-secret";

async function fixture(emails: Array<string | null | undefined>) {
  const t = convexTest(schema, modules);
  await t.run(async ({ db }) => {
    for (const [index, email] of emails.entries()) {
      await db.insert("users", {
        id: `parent-${index}`, email, role: "PARENT",
        createdAt: 0, updatedAt: 0,
      });
    }
  });
  return t;
}

describe("user email lookup", () => {
  beforeEach(() => vi.stubEnv("PUSH_INTERNAL_SECRET", secret));
  afterEach(() => vi.unstubAllEnvs());

  it("normalizes uppercase and whitespace in the requested email", async () => {
    const t = await fixture(["parent@example.com"]);

    expect(await t.query(api.db.findUser, {
      secret, email: "  Parent@Example.COM  ",
    })).toMatchObject({ id: "parent-0", email: "parent@example.com" });
  });

  it("finds a legacy mixed-case email using a normalized email", async () => {
    const t = await fixture(["Parent@Example.COM"]);

    expect(await t.query(api.db.findUser, {
      secret, email: "parent@example.com",
    })).toMatchObject({ id: "parent-0", email: "Parent@Example.COM" });
  });

  it("finds a legacy email containing surrounding whitespace", async () => {
    const t = await fixture(["  Parent@Example.COM  "]);

    expect(await t.query(api.db.findUser, {
      secret, email: "parent@example.com",
    })).toMatchObject({ id: "parent-0" });
  });

  it.each([
    ["Parent@Example.com", "PARENT@example.COM"],
    ["parent@example.com", "Parent@Example.com"],
    ["Parent@Example.com", "parent@example.com"],
  ])("rejects ambiguous normalized matches (%s, %s)", async (first, second) => {
    const t = await fixture([first, second]);

    await expect(t.query(api.db.findUser, {
      secret, email: "parent@example.com",
    })).rejects.toThrow("K tomuto e-mailu existuje více účtů. Kontaktujte správce.");
  });

  it("returns null when no normalized email matches", async () => {
    const t = await fixture(["someone@example.com", null, undefined]);

    expect(await t.query(api.db.findUser, {
      secret, email: "missing@example.com",
    })).toBeNull();
  });

  it("does not match empty legacy emails when the requested email is whitespace", async () => {
    const t = await fixture(["", "  ", null, undefined]);

    expect(await t.query(api.db.findUser, {
      secret, email: "  ",
    })).toBeNull();
  });

  it.each(["wrong", ""])("rejects an invalid server secret (%j)", async invalidSecret => {
    const t = await fixture(["Parent@Example.com"]);

    await expect(t.query(api.db.findUser, {
      secret: invalidSecret, email: "parent@example.com",
    })).rejects.toThrow("Unauthorized");
  });

  it("rejects lookup when the server secret is not configured", async () => {
    const t = await fixture(["Parent@Example.com"]);
    vi.stubEnv("PUSH_INTERNAL_SECRET", "");

    await expect(t.query(api.db.findUser, {
      secret, email: "parent@example.com",
    })).rejects.toThrow("Unauthorized");
  });
});
