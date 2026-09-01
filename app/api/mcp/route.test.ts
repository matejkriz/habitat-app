import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => vi.unstubAllEnvs());

describe("MCP route authentication", () => {
  it("challenges unauthenticated clients with OAuth resource metadata", async () => {
    vi.stubEnv("MCP_RESOURCE_URL", "https://develop.example.cz/api/mcp");
    vi.stubEnv("WORKOS_AUTHKIT_DOMAIN", "https://habitat.authkit.app");
    const response = await GET(
      new Request("https://develop.example.cz/api/mcp", { method: "GET" }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain(
      'resource_metadata="https://develop.example.cz/.well-known/oauth-protected-resource"',
    );
  });
});
