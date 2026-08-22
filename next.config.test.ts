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

  it("allows legacy Clerk profile images", () => {
    expect(nextConfig).toMatchObject({
      images: {
        remotePatterns: expect.arrayContaining([
          {
            protocol: "https",
            hostname: "img.clerk.com",
          },
        ]),
      },
    });
  });
});
