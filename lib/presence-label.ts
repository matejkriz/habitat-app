import type { ChildGender } from "@/lib/types";

export const ALL_CHILDREN_PRESENT_LABEL = "Všechny děti přítomné";
export const PRESENT_CHILDREN_LABEL = "Přítomné děti";
export const ABSENT_CHILDREN_LABEL = "Nepřítomné děti";

export function getPresenceLabel(
  present: boolean,
  gender: ChildGender | null,
): string {
  if (gender === "FEMALE") {
    return present ? "Přítomna" : "Nepřítomna";
  }

  if (gender === "MALE") {
    return present ? "Přítomen" : "Nepřítomen";
  }

  return present ? "Přítomnost" : "Nepřítomnost";
}
