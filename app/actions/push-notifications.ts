"use server";

import { getDbUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { UserRole } from "@/lib/types";

type SerializedPushSubscription = {
  readonly endpoint: string;
  readonly keys: {
    readonly p256dh: string;
    readonly auth: string;
  };
};

function validateEndpoint(endpoint: string): string {
  if (endpoint.length > 4096) throw new Error("Neplatný push endpoint");
  const url = new URL(endpoint);
  if (url.protocol !== "https:") throw new Error("Neplatný push endpoint");
  return url.toString();
}

function validateKey(value: string, name: string): string {
  if (
    value.length < 8 ||
    value.length > 512 ||
    !/^[A-Za-z0-9_-]+={0,2}$/.test(value)
  ) {
    throw new Error(`Neplatný klíč ${name}`);
  }
  return value;
}

async function requireDirector() {
  const user = await getDbUser();
  if (!user || user.role !== UserRole.DIRECTOR) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function registerDirectorPushSubscription(
  subscription: SerializedPushSubscription,
): Promise<void> {
  const user = await requireDirector();
  if (!subscription?.keys) throw new Error("Neplatný push odběr");

  await db.pushSubscriptions.upsertDirector({
    userId: user.id,
    endpoint: validateEndpoint(subscription.endpoint),
    p256dh: validateKey(subscription.keys.p256dh, "p256dh"),
    auth: validateKey(subscription.keys.auth, "auth"),
  });
}

export async function unregisterDirectorPushSubscription(
  endpoint: string,
): Promise<void> {
  const user = await requireDirector();
  await db.pushSubscriptions.removeDirector({
    userId: user.id,
    endpoint: validateEndpoint(endpoint),
  });
}
