export const UNAUTHENTICATED_PATHS = [
  "/",
  "/manifest.json",
  "/sw.js",
  "/offline.html",
  "/api/version",
  "/pwa-launch-check",
  "/login",
  "/callback",
  "/api/webhooks/:path*",
  "/api/mcp/:path*",
  "/.well-known/:path*",
] as const;
