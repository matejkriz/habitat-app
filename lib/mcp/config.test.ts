import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getMcpConfirmationSecret,
  getMcpResourceOrigin,
  getMcpResourceUrl,
  getWorkOSAuthKitIssuer,
} from "./config";

afterEach(() => vi.unstubAllEnvs());

describe("MCP configuration", () => {
  it("keeps the endpoint path as the OAuth resource and exposes its origin", () => {
    vi.stubEnv("MCP_RESOURCE_URL", "https://develop.example.cz/api/mcp");
    expect(getMcpResourceUrl()).toBe("https://develop.example.cz/api/mcp");
    expect(getMcpResourceOrigin()).toBe("https://develop.example.cz");
  });

  it("requires a path-free HTTPS AuthKit issuer", () => {
    vi.stubEnv("WORKOS_AUTHKIT_DOMAIN", "https://habitat.authkit.app");
    expect(getWorkOSAuthKitIssuer()).toBe("https://habitat.authkit.app");

    vi.stubEnv("WORKOS_AUTHKIT_DOMAIN", "https://habitat.authkit.app/oauth2");
    expect(() => getWorkOSAuthKitIssuer()).toThrow("without a path");
  });

  it("rejects short confirmation secrets", () => {
    vi.stubEnv("MCP_CONFIRMATION_SECRET", "short");
    expect(() => getMcpConfirmationSecret()).toThrow("at least 32 characters");
  });
});
