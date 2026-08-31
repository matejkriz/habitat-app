import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { developmentSeed, mergeSeedUser } from "./seedData";

async function upsertUsers(db: MutationCtx["db"]): Promise<void> {
  for (const seedUser of developmentSeed.users) {
    const existingById = await db
      .query("users")
      .withIndex("by_app_id", (query) => query.eq("id", seedUser.id))
      .unique();
    const existing =
      existingById ??
      (await db
        .query("users")
        .withIndex("by_email", (query) => query.eq("email", seedUser.email))
        .unique());
    const user = mergeSeedUser(seedUser, existing ?? undefined);

    if (existing) {
      await db.replace(existing._id, user);
    } else {
      await db.insert("users", user);
    }
  }
}

async function upsertChildren(db: MutationCtx["db"]): Promise<void> {
  for (const child of developmentSeed.children) {
    const existing = await db
      .query("children")
      .withIndex("by_app_id", (query) => query.eq("id", child.id))
      .unique();

    if (existing) {
      await db.replace(existing._id, child);
    } else {
      await db.insert("children", child);
    }
  }
}

async function upsertParentChildren(db: MutationCtx["db"]): Promise<void> {
  for (const relation of developmentSeed.parentChildren) {
    const existing = await db
      .query("parentChildren")
      .withIndex("by_app_id", (query) => query.eq("id", relation.id))
      .unique();

    if (existing) {
      await db.replace(existing._id, relation);
    } else {
      await db.insert("parentChildren", relation);
    }
  }
}

export const development = internalMutation({
  args: {},
  returns: v.object({
    users: v.number(),
    children: v.number(),
    parentChildren: v.number(),
  }),
  handler: async ({ db }) => {
    await upsertUsers(db);
    await upsertChildren(db);
    await upsertParentChildren(db);

    return {
      users: developmentSeed.users.length,
      children: developmentSeed.children.length,
      parentChildren: developmentSeed.parentChildren.length,
    };
  },
});
