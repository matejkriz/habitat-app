import { describe, expect, it } from "vitest";
import {
  getExcuseDayPartForRange,
  parseCancelLunchChoice,
  parseExcuseDayPart,
} from "./excuse-input";
import { ExcuseDayPart } from "./types";

describe("parseCancelLunchChoice", () => {
  it("keeps the existing lunch-cancelling default", () => {
    expect(parseCancelLunchChoice(null)).toBe(true);
    expect(parseCancelLunchChoice("true")).toBe(true);
  });

  it("accepts an explicit choice to keep lunch", () => {
    expect(parseCancelLunchChoice("false")).toBe(false);
  });

  it("rejects unexpected form values", () => {
    expect(() => parseCancelLunchChoice("on")).toThrow(
      "Neplatná volba pro odhlášení oběda.",
    );
  });
});

describe("parseExcuseDayPart", () => {
  it("keeps whole-day absence as the backwards-compatible default", () => {
    expect(parseExcuseDayPart(null)).toBe(ExcuseDayPart.FULL_DAY);
    expect(parseExcuseDayPart("FULL_DAY")).toBe(ExcuseDayPart.FULL_DAY);
  });

  it("accepts both supported partial-day choices", () => {
    expect(parseExcuseDayPart("MORNING")).toBe(ExcuseDayPart.MORNING);
    expect(parseExcuseDayPart("AFTERNOON")).toBe(ExcuseDayPart.AFTERNOON);
  });

  it("rejects unexpected form values", () => {
    expect(() => parseExcuseDayPart("EVENING")).toThrow(
      "Neplatná část dne.",
    );
  });
});

describe("getExcuseDayPartForRange", () => {
  it("preserves a partial-day choice for a single date", () => {
    const date = new Date(2026, 8, 10);
    expect(
      getExcuseDayPartForRange(ExcuseDayPart.AFTERNOON, date, date),
    ).toBe(ExcuseDayPart.AFTERNOON);
  });

  it("forces whole day for a range spanning multiple dates", () => {
    expect(
      getExcuseDayPartForRange(
        ExcuseDayPart.MORNING,
        new Date(2026, 8, 10),
        new Date(2026, 8, 11),
      ),
    ).toBe(ExcuseDayPart.FULL_DAY);
  });
});
