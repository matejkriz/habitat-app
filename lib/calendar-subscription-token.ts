import { createHash, createHmac, randomBytes } from "node:crypto";

function getSigningKey(): string {
  const key = process.env.PUSH_INTERNAL_SECRET;
  if (!key) throw new Error("PUSH_INTERNAL_SECRET is not configured");
  return key;
}

// Domain separation keeps the existing server secret private. Database records
// contain only a random nonce and the token hash; URLs can be recovered on demand.
export function calendarSubscriptionToken(nonce: string): string {
  return createHmac("sha256", getSigningKey()).update(`habitat:calendar-subscription:v1:${nonce}`).digest("base64url");
}

export function hashCalendarToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function calendarSigningKeyId(): string {
  return createHmac("sha256", getSigningKey()).update("habitat:calendar-subscription:key-id:v1").digest("hex");
}

export function newCalendarSubscription() {
  const nonce = randomBytes(32).toString("base64url");
  return { nonce, tokenHash: hashCalendarToken(calendarSubscriptionToken(nonce)) };
}
