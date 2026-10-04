import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

describe("static PWA launch", () => {
  it("keeps the old root identity while opening the public launch document", () => {
    const manifest = JSON.parse(readFileSync("public/manifest.json", "utf8"));
    expect(manifest).toMatchObject({ id: "/", scope: "/", start_url: "/launch.html" });
  });

  it("navigates once after a painted frame without waiting for network resources", () => {
    const html = readFileSync("public/launch.html", "utf8");
    const script = html.match(/<script id="launch-navigation">([\s\S]*?)<\/script>/)?.[1];
    expect(script).toBeDefined();
    expect(html).toContain("data:image/webp;base64,");
    expect(html).not.toMatch(/<(?:script|img)[^>]+src=["']https?:/);

    const frames: FrameRequestCallback[] = [];
    const replace = vi.fn();
    const storage = { setItem: vi.fn(() => { throw new Error("storage denied"); }) };
    const run = new Function("requestAnimationFrame", "location", "sessionStorage", "navigator", "performance", script!);
    run((callback: FrameRequestCallback) => frames.push(callback), { replace, search: "" }, storage, { serviceWorker: { controller: null } }, { now: () => 25, timeOrigin: 1000, getEntriesByType: () => [] });

    expect(replace).not.toHaveBeenCalled();
    frames.shift()!(16);
    expect(replace).not.toHaveBeenCalled();
    frames.shift()!(32);
    expect(replace).toHaveBeenCalledExactlyOnceWith("/");
    expect(frames).toHaveLength(0);
  });
});
