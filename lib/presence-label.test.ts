import { describe, expect, it } from "vitest";
import {
  ALL_CHILDREN_PRESENT_LABEL,
  ABSENT_CHILDREN_LABEL,
  getPresenceLabel,
  PRESENT_CHILDREN_LABEL,
} from "./presence-label";

describe("getPresenceLabel", () => {
  it("uses a masculine label for a present boy", () => {
    expect(getPresenceLabel(true, "MALE")).toBe("Přítomen");
  });

  it("uses a masculine label for an absent boy", () => {
    expect(getPresenceLabel(false, "MALE")).toBe("Nepřítomen");
  });

  it("uses a feminine label for a present girl", () => {
    expect(getPresenceLabel(true, "FEMALE")).toBe("Přítomna");
  });

  it("uses a feminine label for an absent girl", () => {
    expect(getPresenceLabel(false, "FEMALE")).toBe("Nepřítomna");
  });

  it("uses a noun when gender is missing from a legacy record", () => {
    expect(getPresenceLabel(true, null)).toBe("Přítomnost");
  });

  it("uses a gender-neutral label when marking every child as present", () => {
    expect(ALL_CHILDREN_PRESENT_LABEL).toBe("Všechny děti přítomné");
  });

  it("uses natural labels for aggregate child counts", () => {
    expect(PRESENT_CHILDREN_LABEL).toBe("Přítomné děti");
    expect(ABSENT_CHILDREN_LABEL).toBe("Nepřítomné děti");
  });
});
