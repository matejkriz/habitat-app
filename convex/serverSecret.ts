/**
 * Guard for Convex functions that are only ever called by our own Next.js
 * server.
 *
 * Convex publishes every `query`/`mutation` export as a public endpoint, so
 * each one has to authorize itself. These functions take a trusted-caller
 * secret rather than a user identity, because authentication and per-role
 * authorization already happened in the Next.js layer before the call.
 *
 * The env var keeps its historical `PUSH_INTERNAL_SECRET` name so existing
 * Convex and Vercel configuration keeps working without a rename.
 */
export function requireServerSecret(secret: string): void {
  const expected = process.env.PUSH_INTERNAL_SECRET;
  if (!expected || secret !== expected) {
    throw new Error("Unauthorized");
  }
}
