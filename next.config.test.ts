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
