import { describe, expect, it } from "vitest";
import {
  ALL_CHILDREN_PRESENT_LABEL,
  getPresenceLabel,
} from "./presence-label";

describe("getPresenceLabel", () => {
  it("uses a gender-neutral label for a present child", () => {
    expect(getPresenceLabel(true)).toBe("Přítomno");
  });

  it("uses a gender-neutral label for an absent child", () => {
    expect(getPresenceLabel(false)).toBe("Nepřítomno");
  });

  it("uses a gender-neutral label when marking every child as present", () => {
    expect(ALL_CHILDREN_PRESENT_LABEL).toBe("Všechny děti přítomné");
  });
});
