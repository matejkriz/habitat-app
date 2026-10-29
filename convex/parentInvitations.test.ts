import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const secret = "test-parent-invitation-secret";
const now = new Date("2026-10-29T10:00:00Z").getTime();
const args = { secret, directorId: "director", childId: "anna", email: "parent@example.com" };

async function fixture() {
  const t = convexTest(schema, modules);
  await t.run(async ({ db }) => {
    await db.insert("users", {
      id: "director", workosId: "workos-director", email: "director@example.com",
      role: "DIRECTOR", createdAt: now, updatedAt: now,
    });
    await db.insert("children", {
      id: "anna", firstName: "Anna", lastName: "Malá", active: true,
      createdAt: now, updatedAt: now,
    });
  });
  return t;
}

describe("parent invitation assignment", () => {
  beforeEach(() => vi.stubEnv("PUSH_INTERNAL_SECRET", secret));
  afterEach(() => vi.unstubAllEnvs());

  it("creates a parent and child link together and audits the director's action", async () => {
    const t = await fixture();

    const parent = await t.mutation(api.parentInvitations.assignParent, {
      ...args, email: "  Parent@Example.COM  ",
    });

    expect(parent).toEqual({ id: expect.any(String), name: null, email: "parent@example.com" });
    await t.run(async ({ db }) => {
      const users = await db.query("users").collect();
      expect(users).toHaveLength(2);
      expect(users.find(user => user.id === parent.id)).toMatchObject({
        email: "parent@example.com", role: "PARENT",
      });
      expect(users.find(user => user.id === parent.id)?.workosId).toBeUndefined();
      const links = await db.query("parentChildren").collect();
      expect(links).toHaveLength(1);
      expect(links[0]).toMatchObject({ parentId: parent.id, childId: "anna" });
      const audits = await db.query("auditLogs").collect();
      expect(audits).toHaveLength(1);
      expect(audits[0]).toMatchObject({
        userId: "director", action: "CREATE", entityType: "ParentChild", entityId: links[0].id,
        newValue: expect.objectContaining({ parentId: parent.id, childId: "anna", parentEmail: "parent@example.com" }),
      });
    });
  });

  it("reuses an existing parent, including a legacy mixed-case email, without changing identity", async () => {
    const t = await fixture();
    await t.run(async ({ db }) => {
      await db.insert("users", {
        id: "existing", workosId: "workos-existing", name: "Eva Malá",
        email: "Parent@Example.com", image: "https://example.com/avatar.png",
        role: "PARENT", createdAt: now, updatedAt: now,
      });
    });

    expect(await t.mutation(api.parentInvitations.assignParent, args)).toEqual({
      id: "existing", name: "Eva Malá", email: "Parent@Example.com",
    });
    await t.run(async ({ db }) => {
      const users = await db.query("users").collect();
      expect(users).toHaveLength(2);
      expect(users.find(user => user.id === "existing")).toMatchObject({
        workosId: "workos-existing", email: "Parent@Example.com", updatedAt: now,
      });
    });
  });

  it("keeps retries idempotent and can assign the same parent to another child", async () => {
    const t = await fixture();
    const parent = await t.mutation(api.parentInvitations.assignParent, args);
    expect(await t.mutation(api.parentInvitations.assignParent, args)).toEqual(parent);
    await t.run(async ({ db }) => {
      expect(await db.query("users").collect()).toHaveLength(2);
      expect(await db.query("parentChildren").collect()).toHaveLength(1);
      expect(await db.query("auditLogs").collect()).toHaveLength(1);
      await db.insert("children", {
        id: "eva", firstName: "Eva", lastName: "Malá", active: true,
        createdAt: now, updatedAt: now,
      });
    });
    expect(await t.mutation(api.parentInvitations.assignParent, { ...args, childId: "eva" })).toEqual(parent);
    await t.run(async ({ db }) => {
      expect(await db.query("users").collect()).toHaveLength(2);
      expect(await db.query("parentChildren").collect()).toHaveLength(2);
      expect(await db.query("auditLogs").collect()).toHaveLength(2);
    });
  });

  it("does not duplicate the parent or link when requests arrive together", async () => {
    const t = await fixture();
    const parents = await Promise.all([
      t.mutation(api.parentInvitations.assignParent, args),
      t.mutation(api.parentInvitations.assignParent, { ...args, email: "PARENT@EXAMPLE.COM" }),
    ]);
    expect(parents[0]).toEqual(parents[1]);
    await t.run(async ({ db }) => {
      expect(await db.query("users").collect()).toHaveLength(2);
      expect(await db.query("parentChildren").collect()).toHaveLength(1);
      expect(await db.query("auditLogs").collect()).toHaveLength(1);
    });
  });

  it.each(["wrong", ""])("rejects an invalid server secret (%j) without any writes", async invalidSecret => {
    const t = await fixture();
    await expect(t.mutation(api.parentInvitations.assignParent, { ...args, secret: invalidSecret }))
      .rejects.toThrow("Unauthorized");
    await t.run(async ({ db }) => {
      expect(await db.query("users").collect()).toHaveLength(1);
      expect(await db.query("parentChildren").collect()).toHaveLength(0);
    });
  });

  it.each(["PARENT", "TEACHER"] as const)("rejects a %s actor", async role => {
    const t = await fixture();
    await t.run(async ({ db }) => {
      const director = await db.query("users").withIndex("by_app_id", q => q.eq("id", "director")).unique();
      await db.patch(director!._id, { role });
    });
    await expect(t.mutation(api.parentInvitations.assignParent, args)).rejects.toThrow("Unauthorized");
  });

  it("rejects a missing actor", async () => {
    const t = await fixture();
    await expect(t.mutation(api.parentInvitations.assignParent, { ...args, directorId: "missing" }))
      .rejects.toThrow("Unauthorized");
  });

  it("rejects a missing child before creating the parent", async () => {
    const t = await fixture();
    await expect(t.mutation(api.parentInvitations.assignParent, { ...args, childId: "missing" }))
      .rejects.toThrow("Dítě nebylo nalezeno");
    await t.run(async ({ db }) => {
      expect(await db.query("users").collect()).toHaveLength(1);
      expect(await db.query("parentChildren").collect()).toHaveLength(0);
      expect(await db.query("auditLogs").collect()).toHaveLength(0);
    });
  });

  it.each(["", "bad-email", "a@example.com\nb@example.com", "a@", `${"a".repeat(250)}@example.com`])(
    "rejects an invalid email (%j)", async email => {
      const t = await fixture();
      await expect(t.mutation(api.parentInvitations.assignParent, { ...args, email }))
        .rejects.toThrow("Zadejte platný e-mail");
      await t.run(async ({ db }) => {
        expect(await db.query("users").collect()).toHaveLength(1);
        expect(await db.query("parentChildren").collect()).toHaveLength(0);
      });
    },
  );

  it.each(["TEACHER", "DIRECTOR"] as const)("rejects an email already belonging to a %s", async role => {
    const t = await fixture();
    await t.run(async ({ db }) => {
      await db.insert("users", {
        id: "staff", email: "Parent@Example.COM", workosId: "workos-staff", role,
        createdAt: now, updatedAt: now,
      });
    });
    await expect(t.mutation(api.parentInvitations.assignParent, args))
      .rejects.toThrow("není rodičovský");
    await t.run(async ({ db }) => {
      expect(await db.query("parentChildren").collect()).toHaveLength(0);
      expect(await db.query("auditLogs").collect()).toHaveLength(0);
    });
  });

  it("rejects an ambiguous case-insensitive match", async () => {
    const t = await fixture();
    await t.run(async ({ db }) => {
      for (const [id, email] of [["one", "parent@example.com"], ["two", "Parent@example.com"]]) {
        await db.insert("users", { id, email, role: "PARENT", createdAt: now, updatedAt: now });
      }
    });
    await expect(t.mutation(api.parentInvitations.assignParent, args)).rejects.toThrow("více účtů");
    await t.run(async ({ db }) => {
      expect(await db.query("users").collect()).toHaveLength(3);
      expect(await db.query("parentChildren").collect()).toHaveLength(0);
    });
  });
});
