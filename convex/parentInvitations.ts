import { v } from "convex/values";
import { z } from "zod";
import { mutation } from "./_generated/server";
import { requireServerSecret } from "./serverSecret";

const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());

export const assignParent = mutation({
  args: {
    secret: v.string(),
    directorId: v.string(),
    childId: v.string(),
    email: v.string(),
  },
  returns: v.object({
    id: v.string(),
    name: v.union(v.string(), v.null()),
    email: v.union(v.string(), v.null()),
  }),
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);
    const director = await db.query("users")
      .withIndex("by_app_id", q => q.eq("id", args.directorId)).unique();
    if (director?.role !== "DIRECTOR") throw new Error("Unauthorized");

    const emailResult = emailSchema.safeParse(args.email);
    if (!emailResult.success) throw new Error("Zadejte platný e-mail.");
    const email = emailResult.data;
    const child = await db.query("children")
      .withIndex("by_app_id", q => q.eq("id", args.childId)).unique();
    if (!child) throw new Error("Dítě nebylo nalezeno");

    // Existing accounts can contain mixed-case email addresses.
    const matches = (await db.query("users").collect())
      .filter(user => user.email?.trim().toLowerCase() === email);
    if (matches.length > 1) throw new Error("K tomuto e-mailu existuje více účtů. Kontaktujte správce.");
    const existingParent = matches[0];
    if (existingParent && existingParent.role !== "PARENT") {
      throw new Error("E-mail již používá účet, který není rodičovský.");
    }

    const now = Date.now();
    const parent = existingParent ?? { id: crypto.randomUUID(), name: null, email };
    if (!existingParent) {
      await db.insert("users", {
        ...parent, role: "PARENT", createdAt: now, updatedAt: now,
      });
    }
    const existingLink = await db.query("parentChildren")
      .withIndex("by_parent_child", q => q.eq("parentId", parent.id).eq("childId", child.id)).unique();
    if (!existingLink) {
      const linkId = crypto.randomUUID();
      await db.insert("parentChildren", {
        id: linkId, parentId: parent.id, childId: child.id, createdAt: now,
      });
      await db.insert("auditLogs", {
        id: crypto.randomUUID(), userId: director.id, action: "CREATE",
        entityType: "ParentChild", entityId: linkId,
        newValue: {
          parentId: parent.id, parentName: parent.name ?? null, parentEmail: parent.email ?? null,
          childId: child.id, childName: `${child.firstName} ${child.lastName}`,
        },
        createdAt: now,
      });
    }
    return { id: parent.id, name: parent.name ?? null, email: parent.email ?? null };
  },
});
