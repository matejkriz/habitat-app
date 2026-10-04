import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ profile: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => state.profile ? { value: state.profile } : undefined }),
}));
vi.mock("next/font/google", () => ({
  Nunito: () => ({ variable: "nunito" }),
  Geist_Mono: () => ({ variable: "mono" }),
}));
vi.mock("next/script", () => ({ default: () => null }));
vi.mock("@workos-inc/authkit-nextjs/components", () => ({
  AuthKitProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/layout/service-worker-registration", () => ({
  ServiceWorkerRegistration: () => null,
}));

import RootLayout from "./layout";

describe("server-rendered iOS launch image", () => {
  it("puts one unconditional image in the original head before client scripts run", async () => {
    state.profile = "1179x2556";
    const html = renderToStaticMarkup(await RootLayout({ children: <p>Habitat</p> }));
    const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1];
    expect(head).toContain('rel="apple-touch-startup-image"');
    expect(head).toContain('href="/startup/ios/habitat-v1-1179x2556.png"');
    expect(head).not.toContain("media=");
    expect(html.match(/rel="apple-touch-startup-image"/g)).toHaveLength(1);
  });

  it("does not emit an arbitrary image URL from the profile cookie", async () => {
    state.profile = "https://other.example/arbitrary.png";
    const html = renderToStaticMarkup(await RootLayout({ children: <p>Habitat</p> }));
    expect(html).not.toContain("apple-touch-startup-image");
  });
});
