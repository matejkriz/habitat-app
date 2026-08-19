"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  DEV_PERSONA_COOKIE,
  isDevPersonaEmail,
  isDevPersonaId,
  isDevPersonaModeAllowed,
} from "@/lib/dev-persona";

export async function switchDevPersona(personaId: string): Promise<void> {
  if (!isDevPersonaModeAllowed()) {
    throw new Error("Development persona switching is not available");
  }

  const { userId } = await auth();
  const clerkUser = userId ? await currentUser() : null;
  const email = clerkUser?.emailAddresses[0]?.emailAddress;

  if (!userId || !isDevPersonaEmail(email)) {
    throw new Error("Development persona switching is not available");
  }

  if (!isDevPersonaId(personaId)) {
    throw new Error("Unknown development persona");
  }

  const cookieStore = await cookies();
  cookieStore.set(DEV_PERSONA_COOKIE, personaId, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  revalidatePath("/", "layout");
}
