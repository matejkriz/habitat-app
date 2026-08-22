import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const role = v.union(v.literal("PARENT"), v.literal("TEACHER"), v.literal("DIRECTOR"));
const presence = v.union(v.literal("PRESENT"), v.literal("ABSENT"));
const childGender = v.union(v.literal("MALE"), v.literal("FEMALE"));
const excuseStatus = v.union(
  v.literal("NONE"),
  v.literal("EXCUSED"),
  v.literal("UNEXCUSED"),
);
const auditAction = v.union(v.literal("CREATE"), v.literal("UPDATE"), v.literal("DELETE"));

export default defineSchema({
  users: defineTable({
    id: v.string(),
    // Optional so existing Clerk-linked rows can be relinked by email on first WorkOS sign-in.
    workosId: v.optional(v.string()),
    clerkId: v.optional(v.string()),
    name: v.optional(v.union(v.string(), v.null())),
    email: v.optional(v.union(v.string(), v.null())),
    image: v.optional(v.union(v.string(), v.null())),
    role,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_app_id", { fields: ["id"] })
    .index("by_workos_id", { fields: ["workosId"] })
    .index("by_clerk_id", { fields: ["clerkId"] })
    .index("by_email", { fields: ["email"] })
    .index("by_role", { fields: ["role"] }),

  children: defineTable({
    id: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    // Optional during rollout so existing children can be completed in the director UI.
    gender: v.optional(childGender),
    active: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_app_id", { fields: ["id"] })
    .index("by_active", { fields: ["active"] }),

  parentChildren: defineTable({
    id: v.string(),
    parentId: v.string(),
    childId: v.string(),
    createdAt: v.number(),
  })
    .index("by_app_id", { fields: ["id"] })
    .index("by_parent_id", { fields: ["parentId"] })
    .index("by_child_id", { fields: ["childId"] })
    .index("by_parent_child", { fields: ["parentId", "childId"] }),

  attendance: defineTable({
    id: v.string(),
    childId: v.string(),
    date: v.number(),
    presence,
    excuseStatus,
    excuseId: v.optional(v.union(v.string(), v.null())),
    recordedById: v.optional(v.union(v.string(), v.null())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_app_id", { fields: ["id"] })
    .index("by_child_id", { fields: ["childId"] })
    .index("by_date", { fields: ["date"] })
    .index("by_child_date", { fields: ["childId", "date"] })
    .index("by_excuse_id", { fields: ["excuseId"] }),

  excuses: defineTable({
    id: v.string(),
    childId: v.string(),
    fromDate: v.number(),
    toDate: v.number(),
    reason: v.optional(v.union(v.string(), v.null())),
    submittedById: v.string(),
    submittedAt: v.number(),
    autoApproved: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_app_id", { fields: ["id"] })
    .index("by_child_id", { fields: ["childId"] })
    .index("by_submitted_by_id", { fields: ["submittedById"] })
    .index("by_submitted_at", { fields: ["submittedAt"] }),

  closedDays: defineTable({
    id: v.string(),
    date: v.number(),
    description: v.optional(v.union(v.string(), v.null())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_app_id", { fields: ["id"] })
    .index("by_date", { fields: ["date"] }),

  auditLogs: defineTable({
    id: v.string(),
    userId: v.optional(v.union(v.string(), v.null())),
    action: auditAction,
    entityType: v.string(),
    entityId: v.string(),
    previousValue: v.optional(v.any()),
    newValue: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_app_id", { fields: ["id"] })
    .index("by_user_id", { fields: ["userId"] })
    .index("by_entity", { fields: ["entityType", "entityId"] })
    .index("by_created_at", { fields: ["createdAt"] }),
});
