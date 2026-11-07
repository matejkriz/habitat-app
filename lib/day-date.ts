const dayDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit",
});

/** Calendar-day identity is stable for both UTC and Prague-midnight records. */
export function toDayDateKey(value: number | Date): string {
  const parts = Object.fromEntries(dayDateFormatter.formatToParts(value).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Match synchronization: prefer UTC midnight, independent of the caller's timezone. */
export function canonicalDayRecord<T extends { date: number; updatedAt: number; _id: string }>(records: readonly T[], dateKey: string): T | null {
  const utcMidnight = Date.parse(`${dateKey}T00:00:00Z`);
  return [...records].sort((left, right) =>
    Number(right.date === utcMidnight) - Number(left.date === utcMidnight) ||
    right.updatedAt - left.updatedAt || left._id.localeCompare(right._id),
  )[0] ?? null;
}
