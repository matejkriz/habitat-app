// @vitest-environment node
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import jsQR from "jsqr";
import { PaymentQrCode } from "./payment-qr-code";
import { getLunchPayment } from "@/lib/lunch-payment";

describe("branded payment QR readability", () => {
  it.each([
    [5500, "Anna", "Malá"],
    [6550, "Žofie", "Žížalka"],
    [29, "A*AM:1", "Malá%2A"],
    [999_999_999, "Alexandra", "Dvořáková"],
  ])("decodes the rendered QR with the real Habitat logo (%s, %s)", async (priceCents, firstName, lastName) => {
    const payment = getLunchPayment({ month: "2026-09", monthLabel: "září 2026", lastOpenDay: "2026-09-30", priceCents, days: [], childrenWithoutLunch: [], children: [
      { id: "child", firstName, lastName, payableLunches: 1, paid: false, statuses: [] },
    ] });
    const markup = renderToStaticMarkup(<PaymentQrCode value={payment.payload!} />);
    expect(markup).toContain("/habitat-logo.webp");
    const logo = await sharp(readFileSync("public/habitat-logo.webp")).png().toBuffer();
    const embedded = markup.replaceAll("/habitat-logo.webp", `data:image/png;base64,${logo.toString("base64")}`);
    const { data, info } = await sharp(Buffer.from(embedded)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);
    expect(decoded?.data).toBe(payment.payload);
  });
});
