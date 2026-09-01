import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => vi.unstubAllEnvs());

describe("OAuth protected resource metadata", () => {
  it("advertises AuthKit and the exact MCP audience", async () => {
    vi.stubEnv("MCP_RESOURCE_URL", "https://develop.example.cz/api/mcp");
    vi.stubEnv("WORKOS_AUTHKIT_DOMAIN", "https://habitat.authkit.app");
    const response = GET(
      new Request("https://develop.example.cz/.well-known/oauth-protected-resource"),
    );

    await expect(response.json()).resolves.toEqual({
      resource: "https://develop.example.cz/api/mcp",
      authorization_servers: ["https://habitat.authkit.app"],
    });
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });
});
