import { describe, expect, it } from "vitest";
import { formatLunchAmount, parseLunchPrice, validateLunchPriceCents } from "./lunch-price";

describe("lunch pricing", () => {
  it.each([["65", 6500], [" 65,50 ", 6550], ["65.5", 6550], ["0.29", 29], ["0", 0]])(
    "converts %s crowns into integer cents", (input, cents) => {
      expect(parseLunchPrice(input)).toBe(cents);
    },
  );

  it.each(["", " ", "-1", "65.501", "1e3", "NaN", "Infinity", "9007199254740991", null, 65])(
    "rejects invalid prices (%j)", input => {
      expect(() => parseLunchPrice(input)).toThrow();
    },
  );

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("rejects invalid stored cents (%j)", cents => {
    expect(() => validateLunchPriceCents(cents)).toThrow();
  });

  it("formats whole and fractional lunch amounts in Czech crowns", () => {
    expect(formatLunchAmount(3, 6550).replaceAll(/\s/g, " ")).toBe("196,50 Kč");
    expect(formatLunchAmount(3, 6500).replaceAll(/\s/g, " ")).toBe("195 Kč");
    expect(formatLunchAmount(0, 6550).replaceAll(/\s/g, " ")).toBe("0 Kč");
    expect(formatLunchAmount(3, 0).replaceAll(/\s/g, " ")).toBe("0 Kč");
    expect(formatLunchAmount(3, 5500).replaceAll(/\s/g, " ")).toBe("165 Kč");
  });
});
