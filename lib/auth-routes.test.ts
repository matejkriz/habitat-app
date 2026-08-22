import { describe, expect, it } from "vitest";
import { UNAUTHENTICATED_PATHS } from "./auth-routes";

describe("WorkOS unauthenticated routes", () => {
  it("uses Next.js matcher syntax for nested webhook routes", () => {
    expect(UNAUTHENTICATED_PATHS).toContain("/api/webhooks/:path*");
    expect(UNAUTHENTICATED_PATHS).not.toContain("/api/webhooks/**");
  });
});
