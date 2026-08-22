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
});
