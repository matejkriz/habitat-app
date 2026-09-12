import { withAuth } from "@workos-inc/authkit-nextjs";
import type { User as WorkOSUser } from "@workos-inc/node";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "./db";
import { measureServerOperation } from "./server-timing";
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
  workosId: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: UserRole;
  devPersonaId?: DevPersonaId;
};

const getWorkOSName = (user: WorkOSUser): string | null => {
  if (user.name) return user.name;
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return name || null;
};

const toSessionUser = (user: SessionUser): SessionUser => ({
  id: user.id,
  workosId: user.workosId,
  name: user.name,
  email: user.email,
  image: user.image,
  role: user.role,
  ...(user.devPersonaId ? { devPersonaId: user.devPersonaId } : {}),
});

const loadDbUser = async (): Promise<SessionUser | null> => {
  const { user: workosUser } = await measureServerOperation(
    "authkit.withAuth",
    async () => await withAuth(),
  );

  if (!workosUser) {
    return null;
  }

  if (isDevPersonaModeAllowed() && isDevPersonaEmail(workosUser.email)) {
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

    return toSessionUser({
      id: persona.id,
      workosId: persona.workosId,
      name: persona.name,
      email: persona.email,
      image: persona.image,
      role: persona.role,
      devPersonaId: personaId,
    });
  }

  let user = await db.users.get({
    where: { workosId: workosUser.id },
  });

  if (!user) {
    const existingUserByEmail = await db.users.get({
      where: { email: workosUser.email },
    });
    const name = getWorkOSName(workosUser);

    if (existingUserByEmail) {
      user = await db.users.update({
        where: { id: existingUserByEmail.id },
        data: {
          workosId: workosUser.id,
          name: name ?? existingUserByEmail.name,
          image: workosUser.profilePictureUrl,
        },
      });
    } else {
      user = await db.users.create({
        data: {
          workosId: workosUser.id,
          email: workosUser.email,
          name,
          image: workosUser.profilePictureUrl,
          role: "PARENT",
        },
      });
    }
  }

  return toSessionUser(user);
};

/**
 * Returns the current application user, creating or linking it on first WorkOS sign-in.
 * Prefilled users are linked by their verified WorkOS email address.
 */
export const getDbUser = cache(
  async (): Promise<SessionUser | null> =>
    await measureServerOperation("auth.getDbUser", loadDbUser),
);
