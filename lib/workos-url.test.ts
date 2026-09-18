import { describe, expect, it } from "vitest";
import { getWorkOSBaseUrl } from "./workos-url";

describe("getWorkOSBaseUrl", () => {
  it("prefers the current Portless worktree URL over a configured deploy URL", () => {
    expect(
      getWorkOSBaseUrl(
        "https://deployed.example.com/callback",
        "https://feature-branch.habitat-app.localhost",
      ),
    ).toBe("https://feature-branch.habitat-app.localhost");
  });

  it("uses the stable Vercel branch URL for preview deployments", () => {
    expect(
      getWorkOSBaseUrl(
        undefined,
        undefined,
        "habitat-app-git-feature-matejkrizs-projects.vercel.app",
      ),
    ).toBe(
      "https://habitat-app-git-feature-matejkrizs-projects.vercel.app",
    );
  });

  it("falls back to the generated Vercel deployment URL", () => {
    expect(
      getWorkOSBaseUrl(
        undefined,
        undefined,
        undefined,
        "habitat-abc123-matejkrizs-projects.vercel.app",
      ),
    ).toBe("https://habitat-abc123-matejkrizs-projects.vercel.app");
  });

  it("allows plain HTTP only for the isolated local E2E runner", () => {
    expect(
      getWorkOSBaseUrl(
        "http://127.0.0.1:3000/callback",
        undefined,
        undefined,
        undefined,
        "true",
      ),
    ).toBe("http://127.0.0.1:3000");

    expect(() =>
      getWorkOSBaseUrl(
        "http://example.com/callback",
        undefined,
        undefined,
        undefined,
        "true",
      ),
    ).toThrow("loopback");
  });
});
