import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const IOS_PHONE_PROFILES = [
  { deviceWidth: 320, deviceHeight: 568, pixelRatio: 2 },
  { deviceWidth: 375, deviceHeight: 667, pixelRatio: 2 },
  { deviceWidth: 414, deviceHeight: 736, pixelRatio: 3 },
  { deviceWidth: 375, deviceHeight: 812, pixelRatio: 3 },
  { deviceWidth: 414, deviceHeight: 896, pixelRatio: 2 },
  { deviceWidth: 414, deviceHeight: 896, pixelRatio: 3 },
  { deviceWidth: 390, deviceHeight: 844, pixelRatio: 3 },
  { deviceWidth: 428, deviceHeight: 926, pixelRatio: 3 },
  { deviceWidth: 393, deviceHeight: 852, pixelRatio: 3 },
  { deviceWidth: 430, deviceHeight: 932, pixelRatio: 3 },
  { deviceWidth: 402, deviceHeight: 874, pixelRatio: 3 },
  { deviceWidth: 440, deviceHeight: 956, pixelRatio: 3 },
  { deviceWidth: 420, deviceHeight: 912, pixelRatio: 3 },
] as const;

function mediaFor({
  deviceWidth,
  deviceHeight,
  pixelRatio,
}: (typeof IOS_PHONE_PROFILES)[number]) {
  return `(device-width: ${deviceWidth}px) and (device-height: ${deviceHeight}px) and (-webkit-device-pixel-ratio: ${pixelRatio}) and (orientation: portrait)`;
}

function imageUrlFor({
  deviceWidth,
  deviceHeight,
  pixelRatio,
}: (typeof IOS_PHONE_PROFILES)[number]) {
  return `/startup/ios/habitat-v1-${deviceWidth * pixelRatio}x${deviceHeight * pixelRatio}.png`;
}

function readPngMetadata(path: string) {
  const image = readFileSync(resolve(path));

  expect(image.subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );

  return {
    width: image.readUInt32BE(16),
    height: image.readUInt32BE(20),
    colorType: image[25],
  };
}

describe("PWA launch screens", () => {
  it("provides an opaque portrait launch image for every supported iPhone viewport", async () => {
    const configFile = resolve("app/pwa-startup-images.ts");
    expect(existsSync(configFile)).toBe(true);
    if (!existsSync(configFile)) return;

    const startupImageModule = "./pwa-startup-images";
    const { IOS_STARTUP_IMAGES } = (await import(startupImageModule)) as {
      IOS_STARTUP_IMAGES: ReadonlyArray<{ url: string; media: string }>;
    };
    const expectedImages = IOS_PHONE_PROFILES.map((profile) => ({
      url: imageUrlFor(profile),
      media: mediaFor(profile),
    }));

    expect(IOS_STARTUP_IMAGES).toEqual(expectedImages);
    expect(new Set(IOS_STARTUP_IMAGES.map(({ media }) => media)).size).toBe(
      IOS_STARTUP_IMAGES.length,
    );
    expect(IOS_STARTUP_IMAGES.every(({ media }) => !media.includes("prefers-color-scheme"))).toBe(
      true,
    );

    for (const [index, image] of IOS_STARTUP_IMAGES.entries()) {
      const profile = IOS_PHONE_PROFILES[index];
      expect(existsSync(resolve(`public${image.url}`))).toBe(true);
      if (!existsSync(resolve(`public${image.url}`))) continue;

      expect(readPngMetadata(`public${image.url}`)).toEqual({
        width: profile.deviceWidth * profile.pixelRatio,
        height: profile.deviceHeight * profile.pixelRatio,
        colorType: 2,
      });
    }
  });

  it("wires the iOS launch images through the Next.js Metadata API", () => {
    const layout = readFileSync(resolve("app/layout.tsx"), "utf8");

    expect(layout).toContain(
      'import { IOS_STARTUP_IMAGES } from "@/app/pwa-startup-images";',
    );
    expect(layout).toContain("startupImage: IOS_STARTUP_IMAGES");
  });

  it("renders the Habitat wordmark into the launch header", async () => {
    const image = resolve(
      "public/startup/ios/habitat-v1-1179x2556.png",
    );
    expect(existsSync(image)).toBe(true);
    if (!existsSync(image)) return;

    const pixelRatio = 3;
    const safeAreaTop = 59;
    const logoRegion = await sharp(image)
      .extract({
        left: 16 * pixelRatio,
        top: (safeAreaTop + 16) * pixelRatio,
        width: 99 * pixelRatio,
        height: 32 * pixelRatio,
      })
      .png()
      .toBuffer();
    const logoStats = await sharp(logoRegion).stats();

    expect(
      logoStats.channels.slice(0, 3).some(({ min }) => min < 220),
    ).toBe(true);
  });

  it("keeps the Android-generated splash cream and installable", () => {
    const manifest = JSON.parse(
      readFileSync(resolve("public/manifest.json"), "utf8"),
    ) as {
      name?: string;
      display?: string;
      background_color?: string;
      theme_color?: string;
      icons?: Array<{ sizes?: string; type?: string }>;
    };

    expect(manifest).toMatchObject({
      name: "Habitat Docházka",
      display: "standalone",
      background_color: "#FDF8F3",
      theme_color: "#D4A84B",
    });
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: "512x512", type: "image/png" }),
      ]),
    );
  });
});
