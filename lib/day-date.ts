const dayDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit",
});

/** Calendar-day identity is stable for both UTC and Prague-midnight records. */
export function toDayDateKey(value: number | Date): string {
  const parts = Object.fromEntries(dayDateFormatter.formatToParts(value).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
