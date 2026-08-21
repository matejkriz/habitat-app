import { describe, expect, it } from "vitest";
import * as seedData from "../convex/seedData";
import type { SeedUser } from "../convex/seedData";

const { developmentSeed } = seedData;

describe("development seed data", () => {
  it("uses unique stable IDs and valid parent-child relationships", () => {
    const parentIds = new Set(
      developmentSeed.users
        .filter((user) => user.role === "PARENT")
        .map((user) => user.id),
    );
    const childIds = new Set(developmentSeed.children.map((child) => child.id));
    const allIds = [
      ...developmentSeed.users.map((user) => user.id),
      ...developmentSeed.children.map((child) => child.id),
      ...developmentSeed.parentChildren.map((relation) => relation.id),
    ];

    expect(developmentSeed.parentChildren).toHaveLength(6);
    expect(new Set(allIds).size).toBe(allIds.length);

    for (const relation of developmentSeed.parentChildren) {
      expect(parentIds).toContain(relation.parentId);
      expect(childIds).toContain(relation.childId);
    }

    for (const parentId of parentIds) {
      expect(
        developmentSeed.parentChildren.some(
          (relation) => relation.parentId === parentId,
        ),
      ).toBe(true);
    }

    for (const childId of childIds) {
      expect(
        developmentSeed.parentChildren.some(
          (relation) => relation.childId === childId,
        ),
      ).toBe(true);
    }

    expect(developmentSeed.children.every((child) => child.gender === "MALE" || child.gender === "FEMALE")).toBe(true);
  });

  it("preserves an existing Clerk identity when a user is reseeded", () => {
    const mergeSeedUser = (
      seedData as unknown as {
        mergeSeedUser?: (seed: SeedUser, existing?: SeedUser) => SeedUser;
      }
    ).mergeSeedUser;
    const seedUser = developmentSeed.users[0];
    const linkedUser = {
      ...seedUser,
      clerkId: "user_linked_from_clerk",
      image: "https://example.test/avatar.png",
      name: "Dočasné jméno",
    } satisfies SeedUser;

    expect(mergeSeedUser).toBeTypeOf("function");
    expect(mergeSeedUser?.(seedUser, linkedUser)).toMatchObject({
      clerkId: linkedUser.clerkId,
      image: linkedUser.image,
      name: seedUser.name,
      email: seedUser.email,
      role: seedUser.role,
    });
  });
});
