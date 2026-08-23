export const RETRY_DELAYS_MS = [
  15_000,
  60_000,
  5 * 60_000,
  15 * 60_000,
  60 * 60_000,
  4 * 60 * 60_000,
  12 * 60 * 60_000,
  24 * 60 * 60_000,
  48 * 60 * 60_000,
  72 * 60 * 60_000,
] as const;

export function getRetryDelayMs(attemptCount: number): number | null {
  return RETRY_DELAYS_MS[attemptCount - 1] ?? null;
}

export function isExpiredSubscriptionStatus(statusCode: number | null): boolean {
  return statusCode === 404 || statusCode === 410;
}
