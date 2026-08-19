import { auth, currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { db } from "./db";
import {
  DEV_PERSONA_COOKIE,
  isDevPersonaEmail,
  isDevPersonaModeAllowed,
  resolveDevPersonaId,
  type DevPersonaId,
} from "./dev-persona";
import type { UserRole } from "./types";

export type SessionUser = {
  id: string;
  clerkId: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: UserRole;
  devPersonaId?: DevPersonaId;
};

/**
 * Get or create user from Clerk authentication
 * Returns the database user with role information
 *
 * This function handles three cases:
 * 1. User exists with matching clerkId - return them
 * 2. User exists with matching email but different/no clerkId - link the Clerk account
 * 3. New user - create with default PARENT role
 */
export async function getDbUser(): Promise<SessionUser | null> {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  let clerkUser: Awaited<ReturnType<typeof currentUser>> = null;

  if (isDevPersonaModeAllowed()) {
    clerkUser = await currentUser();
    const email = clerkUser?.emailAddresses[0]?.emailAddress;

    if (isDevPersonaEmail(email)) {
      const cookieStore = await cookies();
      const personaId = resolveDevPersonaId(
        cookieStore.get(DEV_PERSONA_COOKIE)?.value,
      );
      const persona = await db.users.get({ where: { id: personaId } });

      if (!persona) {
        throw new Error(
          `Development persona ${personaId} is missing. Run pnpm seed:dev.`,
        );
      }

      return {
        id: persona.id,
        clerkId: persona.clerkId,
        name: persona.name,
        email: persona.email,
        image: persona.image,
        role: persona.role,
        devPersonaId: personaId,
      };
    }
  }

  // Try to find existing user by clerkId
  let user = await db.users.get({
    where: { clerkId: userId },
  });

  // If user doesn't exist by clerkId, try to find by email and link
  if (!user) {
    clerkUser ??= await currentUser();
    if (!clerkUser) {
      return null;
    }

    const email = clerkUser.emailAddresses[0]?.emailAddress;

    if (email) {
      // Check if a user with this email exists (e.g., from seed data)
      const existingUserByEmail = await db.users.get({
        where: { email },
      });

      if (existingUserByEmail) {
        // Link the Clerk account to the existing user
        user = await db.users.update({
          where: { id: existingUserByEmail.id },
          data: {
            clerkId: userId,
            name:
              clerkUser.firstName && clerkUser.lastName
                ? `${clerkUser.firstName} ${clerkUser.lastName}`
                : existingUserByEmail.name,
            image: clerkUser.imageUrl ?? existingUserByEmail.image,
          },
        });
      }
    }

    // If still no user, create a new one
    if (!user) {
      user = await db.users.create({
        data: {
          clerkId: userId,
          email: clerkUser.emailAddresses[0]?.emailAddress ?? null,
          name:
            clerkUser.firstName && clerkUser.lastName
              ? `${clerkUser.firstName} ${clerkUser.lastName}`
              : clerkUser.firstName ?? clerkUser.lastName ?? null,
          image: clerkUser.imageUrl ?? null,
          role: "PARENT", // Default role for new users
        },
      });
    }
  }

  return {
    id: user.id,
    clerkId: user.clerkId,
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role,
  };
}

/**
 * Sync user data from Clerk (call on sign-in to update profile info)
 */
export async function syncUserFromClerk(): Promise<SessionUser | null> {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  const clerkUser = await currentUser();
  if (!clerkUser) {
    return null;
  }

  const email = clerkUser.emailAddresses[0]?.emailAddress ?? null;
  const name =
    clerkUser.firstName && clerkUser.lastName
      ? `${clerkUser.firstName} ${clerkUser.lastName}`
      : clerkUser.firstName ?? clerkUser.lastName ?? null;

  // First try to find by clerkId
  let user = await db.users.get({
    where: { clerkId: userId },
  });

  if (user) {
    // Update existing user
    user = await db.users.update({
      where: { clerkId: userId },
      data: {
        email,
        name,
        image: clerkUser.imageUrl ?? null,
      },
    });
  } else if (email) {
    // Try to find by email and link
    const existingUserByEmail = await db.users.get({
      where: { email },
    });

    if (existingUserByEmail) {
      user = await db.users.update({
        where: { id: existingUserByEmail.id },
        data: {
          clerkId: userId,
          name: name ?? existingUserByEmail.name,
          image: clerkUser.imageUrl ?? existingUserByEmail.image,
        },
      });
    } else {
      // Create new user
      user = await db.users.create({
        data: {
          clerkId: userId,
          email,
          name,
          image: clerkUser.imageUrl ?? null,
          role: "PARENT",
        },
      });
    }
  } else {
    // No email, create new user
    user = await db.users.create({
      data: {
        clerkId: userId,
        email: null,
        name,
        image: clerkUser.imageUrl ?? null,
        role: "PARENT",
      },
    });
  }

  return {
    id: user.id,
    clerkId: user.clerkId,
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role,
  };
}
