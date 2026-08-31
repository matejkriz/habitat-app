import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type ManifestIcon = {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
};

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

describe("PWA icons", () => {
  it("provides separate install and maskable PNG icons for Android", () => {
    const manifest = JSON.parse(
      readFileSync(resolve("public/manifest.json"), "utf8"),
    ) as { icons: ManifestIcon[] };

    expect(manifest.icons).toEqual([
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ]);

    for (const icon of manifest.icons) {
      const size = Number(icon.sizes.split("x")[0]);
      expect(readPngMetadata(`public${icon.src}`)).toEqual({
        width: size,
        height: size,
        colorType: 2,
      });
    }
  });

  it("provides an opaque 180px Apple touch icon for iOS", () => {
    expect(readPngMetadata("app/apple-icon.png")).toEqual({
      width: 180,
      height: 180,
      colorType: 2,
    });
  });
});
