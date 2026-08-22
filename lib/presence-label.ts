export const ALL_CHILDREN_PRESENT_LABEL = "Všechny děti přítomné";

export function getPresenceLabel(present: boolean): string {
  return present ? "Přítomno" : "Nepřítomno";
}
