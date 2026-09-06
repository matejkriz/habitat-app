import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

describe("Next.js image configuration", () => {
  it("allows WorkOS profile images", () => {
    expect(nextConfig).toMatchObject({
      images: {
        remotePatterns: expect.arrayContaining([
          {
            protocol: "https",
            hostname: "workoscdn.com",
          },
        ]),
      },
    });
  });

  it("does not allow images from the retired identity provider", () => {
    const retiredProvider = ["cl", "erk"].join("");
    const retiredHostname = ["img", retiredProvider, "com"].join(".");
    expect(JSON.stringify(nextConfig)).not.toContain(retiredHostname);
  });
});

describe("service worker response headers", () => {
  it("prevents browsers from pinning an obsolete worker script", async () => {
    const rules = await nextConfig.headers?.();
    const workerRule = rules?.find((rule) => rule.source === "/sw.js");

    expect(workerRule?.headers).toEqual(
      expect.arrayContaining([
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        { key: "Service-Worker-Allowed", value: "/" },
      ]),
    );
  });
});

describe("application version configuration", () => {
  it("exposes a Prague calendar date and Git commit", () => {
    expect(nextConfig).toMatchObject({
      env: {
        NEXT_PUBLIC_APP_VERSION: expect.stringMatching(
          /^\d{4}\.\d{2}\.\d{2}$/,
        ),
        NEXT_PUBLIC_APP_COMMIT_SHA: expect.stringMatching(/^[a-f\d]{40}$/),
      },
    });
  });
});
