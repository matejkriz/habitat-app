export type CalendarKind = "habitat" | "jidelnicek";

export type CalendarFeedEvent = {
  readonly id: string;
  readonly date: string;
  readonly summary: string;
  readonly description?: string;
  readonly updatedAt: number;
  readonly sequence: number;
  readonly cancelled: boolean;
};

const calendarNames: Record<CalendarKind, string> = {
  habitat: "Habitat",
  jidelnicek: "Habitat jídelníček",
};
const encoder = new TextEncoder();

/** TEXT values cannot introduce properties or calendar components. */
function escapeText(value: string): string {
  return Array.from(value.replace(/\r\n|\r/g, "\n"))
    .filter((character) => {
      const code = character.codePointAt(0)!;
      return character === "\n" || character === "\t" ||
        (code >= 32 && (code < 127 || code > 159));
    })
    .join("")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/** RFC 5545 limits physical content lines to 75 octets, not characters. */
function foldLine(value: string): string {
  const lines: string[] = [];
  let line = "";
  let bytes = 0;

  for (const character of value) {
    const length = encoder.encode(character).length;
    if (bytes + length > 75) {
      lines.push(line);
      line = " ";
      bytes = 1;
    }
    line += character;
    bytes += length;
  }
  lines.push(line);
  return lines.join("\r\n");
}

function dayBounds(date: string): { start: string; end: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid calendar date");
  const day = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== date) {
    throw new Error("Invalid calendar date");
  }
  day.setUTCDate(day.getUTCDate() + 1);
  const nextDay = day.toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDay)) throw new Error("Invalid calendar end date");
  return { start: date.replace(/-/g, ""), end: nextDay.replace(/-/g, "") };
}

function timestamp(value: number): string {
  if (!Number.isFinite(value)) throw new Error("Invalid calendar timestamp");
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/**
 * A complete, read-only calendar snapshot. Event IDs deliberately do not depend
 * on subscription credentials, deployment hostnames, titles, or revisions.
 */
export function serializeCalendar(
  kind: CalendarKind,
  events: readonly CalendarFeedEvent[],
  appOrigin: string,
): string {
  const origin = new URL(appOrigin);
  if (origin.protocol !== "https:" && origin.protocol !== "http:") {
    throw new Error("Invalid calendar application origin");
  }
  // Only the public app origin is included, even if the input has credentials,
  // a subscription path, or query parameters.
  const appUrl = new URL("/", origin.origin).toString();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Habitat//Habitat App//CS",
    "CALSCALE:GREGORIAN",
    `NAME:${escapeText(calendarNames[kind])}`,
    `X-WR-CALNAME:${escapeText(calendarNames[kind])}`,
    "X-WR-TIMEZONE:Europe/Prague",
    // These are refresh hints; receiving services choose their own schedule.
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  for (const event of [...events].sort((left, right) =>
    left.date < right.date ? -1 : left.date > right.date ? 1 :
      left.id < right.id ? -1 : left.id > right.id ? 1 : 0)) {
    if (!Number.isSafeInteger(event.sequence) || event.sequence < 0) {
      throw new Error("Invalid calendar sequence");
    }
    const { start, end } = dayBounds(event.date);
    const modified = timestamp(event.updatedAt);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${kind}-${encodeURIComponent(event.id)}@calendar.habitatzbraslav.cz`,
      `DTSTAMP:${modified}`,
      `LAST-MODIFIED:${modified}`,
      `SEQUENCE:${event.sequence}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${escapeText(event.summary)}`,
    );
    if (event.description !== undefined) {
      lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    }
    lines.push(
      `STATUS:${event.cancelled ? "CANCELLED" : "CONFIRMED"}`,
      "TRANSP:TRANSPARENT",
      `URL:${appUrl}`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
