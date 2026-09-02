import { describe, expect, it } from "vitest";
import {
  getEffectiveCancelLunch,
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

describe("getEffectiveCancelLunch", () => {
  it("always keeps lunch for an afternoon-only absence", () => {
    expect(getEffectiveCancelLunch(ExcuseDayPart.AFTERNOON, true)).toBe(false);
  });

  it("preserves the parent's choice for whole-day and morning absences", () => {
    expect(getEffectiveCancelLunch(ExcuseDayPart.FULL_DAY, true)).toBe(true);
    expect(getEffectiveCancelLunch(ExcuseDayPart.MORNING, false)).toBe(false);
  });
});
