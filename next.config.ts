import { execFileSync } from "node:child_process";
import type { NextConfig } from "next";

const versionParts = Object.fromEntries(
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(new Date())
    .map(({ type, value }) => [type, value]),
);
const appVersion = [
  versionParts.year,
  versionParts.month,
  versionParts.day,
].join(".");
const appCommitSha =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();

const nextConfig: NextConfig = {
  turbopack: {},
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
    NEXT_PUBLIC_APP_COMMIT_SHA: appCommitSha,
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          { key: "Content-Security-Policy", value: "default-src 'self'" },
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "workoscdn.com",
      },
    ],
  },
};

export default nextConfig;
