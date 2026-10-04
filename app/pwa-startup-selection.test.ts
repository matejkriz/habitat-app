import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";
import { IOS_STARTUP_IMAGE_SCRIPT, IOS_STARTUP_IMAGES } from "./pwa-startup-images";

function runSelection(window: Window, matchingUrl?: string) {
  window.matchMedia = ((media: string) => ({
    matches: IOS_STARTUP_IMAGES.some(
      (image) => image.url === matchingUrl && image.media === media,
    ),
  })) as typeof window.matchMedia;
  window.eval(IOS_STARTUP_IMAGE_SCRIPT);
}

describe("iOS launch image selection", () => {
  it.each([
    "/startup/ios/habitat-v1-1179x2556.png",
    "/startup/ios/habitat-v1-1170x2532.png",
    "/startup/ios/habitat-v1-750x1334.png",
  ])("installs one unconditional link for %s", (url) => {
    const window = new Window();
    runSelection(window, url);
    const links = window.document.head.querySelectorAll(
      'link[rel="apple-touch-startup-image"]',
    );
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe(url);
    expect(links[0].hasAttribute("media")).toBe(false);
  });

  it("does not declare an image with the wrong dimensions for an unknown device", () => {
    const window = new Window();
    runSelection(window);
    expect(window.document.head.querySelector('link[rel="apple-touch-startup-image"]')).toBeNull();
  });

  it("does not duplicate the link when selection runs again", () => {
    const window = new Window();
    const url = "/startup/ios/habitat-v1-1179x2556.png";
    runSelection(window, url);
    runSelection(window, url);
    expect(window.document.head.querySelectorAll('link[rel="apple-touch-startup-image"]')).toHaveLength(1);
  });
});
