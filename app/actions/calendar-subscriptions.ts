"use server";

import { getDbUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { calendarSubscriptionToken, newCalendarSubscription } from "@/lib/calendar-subscription-token";
import { getWorkOSBaseUrl } from "@/lib/workos-url";

async function subscriptionLinks(rotate: boolean) {
  const user = await getDbUser();
  if (!user) throw new Error("Pro odběr kalendáře se přihlaste.");
  const origin = getWorkOSBaseUrl();
  const nonce = await db.calendarSubscriptions.upsert({ userId: user.id, ...newCalendarSubscription(), rotate });
  const base = `${origin}/api/calendars/${calendarSubscriptionToken(nonce)}`;
  return { habitat: `${base}/habitat.ics`, jidelnicek: `${base}/jidelnicek.ics` };
}

export async function getCalendarSubscriptionLinks() {
  return subscriptionLinks(false);
}

export async function rotateCalendarSubscriptionLinks() {
  return subscriptionLinks(true);
}

export async function revokeCalendarSubscriptionLinks(): Promise<void> {
  const user = await getDbUser();
  if (!user) throw new Error("Pro správu odběru se přihlaste.");
  await db.calendarSubscriptions.revoke(user.id);
}
