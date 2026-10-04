import { Window } from "happy-dom";
import { describe, expect, it, vi } from "vitest";
import {
  getIosStartupImage,
  IOS_STARTUP_IMAGE_SCRIPT,
  IOS_STARTUP_IMAGES,
  IOS_STARTUP_PROFILE_COOKIE,
} from "./pwa-startup-images";

function createBrowser(matchingProfile?: string) {
  const window = new Window({ url: "https://habitat.example/" });
  window.matchMedia = ((media: string) => ({
    matches: IOS_STARTUP_IMAGES.some(
      (image) => image.url === getIosStartupImage(matchingProfile)?.url && image.media === media,
    ),
  })) as typeof window.matchMedia;
  const reload = vi.spyOn(window.location, "reload").mockImplementation(() => {});
  return { window, reload };
}

describe("iOS launch image selection", () => {
  it.each(["1179x2556", "1170x2532", "750x1334"])(
    "persists profile %s and reloads once for server HTML", (profile) => {
      const { window, reload } = createBrowser(profile);
      window.eval(IOS_STARTUP_IMAGE_SCRIPT);
      expect(window.document.cookie).toContain(`${IOS_STARTUP_PROFILE_COOKIE}=${profile}`);
      expect(reload).toHaveBeenCalledTimes(1);
      window.eval(IOS_STARTUP_IMAGE_SCRIPT);
      expect(reload).toHaveBeenCalledTimes(1);
      // The installer needs the link from the server, not a DOM mutation.
      expect(window.document.head.querySelector('link[rel="apple-touch-startup-image"]')).toBeNull();
      expect(getIosStartupImage(profile)?.url).toBe(`/startup/ios/habitat-v1-${profile}.png`);
    },
  );

  it("does not reload an unknown device", () => {
    const { window, reload } = createBrowser();
    window.eval(IOS_STARTUP_IMAGE_SCRIPT);
    expect(window.document.cookie).toBe("");
    expect(reload).not.toHaveBeenCalled();
  });

  it("does not create a reload loop when cookies cannot be stored", () => {
    const { window, reload } = createBrowser("1179x2556");
    vi.spyOn(window.document, "cookie", "set").mockImplementation(() => {});
    window.eval(IOS_STARTUP_IMAGE_SCRIPT);
    expect(reload).not.toHaveBeenCalled();
  });

  it.each([undefined, "1x1", "https://other.example/image.png", "../1179x2556"])(
    "ignores unsupported cookie profile %s", (profile) => {
      expect(getIosStartupImage(profile)).toBeUndefined();
    },
  );
});
