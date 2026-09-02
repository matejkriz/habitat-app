import { describe, expect, it } from "vitest";
import { parseCancelLunchChoice } from "./excuse-input";

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
