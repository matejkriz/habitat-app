import { describe, expect, it } from "vitest";
import { parseExcuseReason, validateExcuseReason } from "./excuse-reason";
import { ExcuseValidationError } from "./excuse-rules";

describe("excuse reason limit", () => {
  it("accepts 500 characters, trims normal input and preserves optional reasons", () => {
    expect(parseExcuseReason("ž".repeat(500))).toBe("ž".repeat(500));
    expect(parseExcuseReason(" Nemoc ")).toBe("Nemoc");
    expect(parseExcuseReason("   ")).toBeNull();
    expect(parseExcuseReason(null)).toBeNull();
  });

  it.each(["x".repeat(501), " ".repeat(501), 42, { reason: "Nemoc" }])(
    "rejects oversized or non-text input without silently truncating it",
    (reason) => {
      expect(() => parseExcuseReason(reason)).toThrow(ExcuseValidationError);
      expect(() => validateExcuseReason(reason)).toThrow(ExcuseValidationError);
    },
  );
});
