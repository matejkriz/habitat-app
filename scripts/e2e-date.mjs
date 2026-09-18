export function previousSchoolDay(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "Europe/Prague",
      year: "numeric",
    })
      .formatToParts(now)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, Number(value)]),
  );
  const candidate = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day - 1, 12),
  );
  while ([0, 5, 6].includes(candidate.getUTCDay())) {
    candidate.setUTCDate(candidate.getUTCDate() - 1);
  }
  return candidate.toISOString().slice(0, 10);
}
