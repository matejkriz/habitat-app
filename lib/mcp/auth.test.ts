import { describe, expect, it } from "vitest";
import { getWorkosUserId, toMcpAuthInfo } from "./auth";

describe("MCP access token claims", () => {
  it("maps only verified identity and OAuth fields into request context", () => {
    const auth = toMcpAuthInfo(
      "access-token",
      {
        sub: "user_123",
        client_id: "chatgpt-client",
        scope: "openid profile",
        exp: 2_000_000_000,
      },
      "https://develop.example.cz/api/mcp",
    );

    expect(auth).toMatchObject({
      clientId: "chatgpt-client",
      scopes: ["openid", "profile"],
      expiresAt: 2_000_000_000,
      extra: { workosUserId: "user_123" },
    });
    expect(getWorkosUserId(auth)).toBe("user_123");
  });

  it("rejects tokens without a user subject", () => {
    expect(() =>
      toMcpAuthInfo(
        "access-token",
        { exp: 2_000_000_000 },
        "https://develop.example.cz/api/mcp",
      ),
    ).toThrow("no subject");
  });

  it("rejects tokens without an expiration", () => {
    expect(() =>
      toMcpAuthInfo(
        "access-token",
        { sub: "user_123" },
        "https://develop.example.cz/api/mcp",
      ),
    ).toThrow("no expiration");
  });
});
