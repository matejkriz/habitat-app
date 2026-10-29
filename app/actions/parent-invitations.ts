"use server";

import { getWorkOS } from "@workos-inc/authkit-nextjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDbUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function inviteParentToChild(childId: string, email: string) {
  const user = await getDbUser();
  if (!user || user.role !== "DIRECTOR") throw new Error("Unauthorized");

  const parsedEmail = z.string().trim().toLowerCase().pipe(z.email().max(254)).safeParse(email);
  if (!parsedEmail.success) throw new Error("Zadejte platný e-mail");

  const parent = await db.parentInvitations.assign({
    directorId: user.id, childId, email: parsedEmail.data,
  });

  let emailSent = false;
  try {
    const management = getWorkOS().userManagement;
    const invitationList = await management.listInvitations({ email: parsedEmail.data, limit: 100 });
    const invitations = await invitationList.autoPagination();
    const pending = invitations.find(invitation =>
      !invitation.organizationId && invitation.state === "pending" &&
      new Date(invitation.expiresAt).getTime() > Date.now(),
    );
    if (pending) {
      await management.resendInvitation(pending.id, { locale: "cs" });
    } else {
      await management.sendInvitation({ email: parsedEmail.data, locale: "cs", expiresInDays: 7 });
    }
    emailSent = true;
  } catch {
    // Keep the assignment so a failed delivery can be retried without losing it.
  }

  revalidatePath("/reditel/deti");
  revalidatePath("/rodic");
  return { parent, emailSent };
}
