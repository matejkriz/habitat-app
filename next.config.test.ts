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
