export const UNAUTHENTICATED_PATHS = [
  "/",
  "/manifest.json",
  "/login",
  "/callback",
  "/api/webhooks/:path*",
  "/api/mcp/:path*",
  "/.well-known/:path*",
] as const;
