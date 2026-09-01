import { describe, expect, it } from "vitest";
import { UNAUTHENTICATED_PATHS } from "./auth-routes";

describe("WorkOS unauthenticated routes", () => {
  it("lets the root page redirect signed-out users through the login route", () => {
    expect(UNAUTHENTICATED_PATHS).toContain("/");
  });

  it("keeps the service worker precache manifest public", () => {
    expect(UNAUTHENTICATED_PATHS).toContain("/manifest.json");
  });

  it("uses Next.js matcher syntax for nested webhook routes", () => {
    expect(UNAUTHENTICATED_PATHS).toContain("/api/webhooks/:path*");
    expect(UNAUTHENTICATED_PATHS).not.toContain("/api/webhooks/**");
  });

  it("leaves bearer-authenticated MCP discovery outside cookie auth", () => {
    expect(UNAUTHENTICATED_PATHS).toContain("/api/mcp/:path*");
    expect(UNAUTHENTICATED_PATHS).toContain("/.well-known/:path*");
  });
});
