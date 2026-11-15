import { afterEach, describe, expect, it, vi } from "vitest";
import { serializeCalendar, type CalendarFeedEvent } from "./ical";

const origin = "https://app.habitatzbraslav.cz";
const baseEvent: CalendarFeedEvent = {
  id: "day:2026-11-10",
  date: "2026-11-10",
  summary: "Výlet do lesa",
  updatedAt: Date.parse("2026-11-09T12:34:56Z"),
  sequence: 0,
  cancelled: false,
};

function unfold(value: string): string {
  return value.replace(/\r\n[ \t]/g, "");
}

function property(value: string, name: string): string | undefined {
  return unfold(value).split("\r\n").find((line) => line.startsWith(`${name}:`));
}

afterEach(() => vi.unstubAllEnvs());

describe("iCalendar subscription serialization", () => {
  it("publishes transparent all-day events with exclusive end dates and stable revision metadata", () => {
    const calendar = serializeCalendar("habitat", [baseEvent], origin);
    expect(calendar).toContain("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n");
    expect(calendar).toContain("X-WR-CALNAME:Habitat\r\n");
    expect(calendar).toContain("DTSTART;VALUE=DATE:20261110\r\nDTEND;VALUE=DATE:20261111\r\n");
    expect(calendar).toContain("DTSTAMP:20261109T123456Z\r\nLAST-MODIFIED:20261109T123456Z\r\nSEQUENCE:0\r\n");
    expect(calendar).toContain("STATUS:CONFIRMED\r\nTRANSP:TRANSPARENT\r\n");
    expect(calendar).toContain(`URL:${origin}/\r\n`);
    expect(calendar).toMatch(/END:VCALENDAR\r\n$/);
    expect(calendar.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
    expect(calendar).not.toMatch(/METHOD:REQUEST|BEGIN:VALARM|ATTENDEE:/);
  });

  it("folds UTF-8 at 75 octets without splitting Czech characters or emoji", () => {
    const description = "Žluťoučký kůň 🥣; hrášková polévka, zelenina. ".repeat(15);
    const calendar = serializeCalendar("jidelnicek", [{ ...baseEvent, description }], origin);
    const encoder = new TextEncoder();
    for (const line of calendar.split("\r\n")) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(calendar).toContain("\r\n ");
    expect(property(calendar, "DESCRIPTION")).toBe(
      `DESCRIPTION:${description.replace(/;/g, "\\;").replace(/,/g, "\\,")}`,
    );
    expect(calendar).not.toContain("�");
    expect(calendar).toContain("X-WR-CALNAME:Habitat jídelníček\r\n");
  });

  it("escapes source text so it cannot inject events, alarms, or other properties", () => {
    const summary = "Výlet\\les; ráno, odpoledne\r\nEND:VEVENT\r\nBEGIN:VALARM\rATTENDEE:evil\nX-TEST:yes\u0000\u0007\u007f";
    const calendar = serializeCalendar("habitat", [{ ...baseEvent, summary, id: "day\r\nBEGIN:VEVENT" }], origin);
    const unfolded = unfold(calendar);
    expect(unfolded.split("\r\n").filter((line) => line === "BEGIN:VEVENT")).toHaveLength(1);
    expect(unfolded.split("\r\n")).not.toContain("BEGIN:VALARM");
    expect(property(calendar, "SUMMARY")).toBe(
      "SUMMARY:Výlet\\\\les\\; ráno\\, odpoledne\\nEND:VEVENT\\nBEGIN:VALARM\\nATTENDEE:evil\\nX-TEST:yes",
    );
    expect(property(calendar, "UID")).toContain("day%0D%0ABEGIN%3AVEVENT");
  });

  it("keeps event identity across edits, cancellation, and deployment origins", () => {
    const initial = serializeCalendar("habitat", [baseEvent], origin);
    const edited = serializeCalendar("habitat", [{ ...baseEvent, summary: "Změněný výlet", sequence: 1 }], "https://developapp.habitatzbraslav.cz");
    const cancelled = serializeCalendar("habitat", [{ ...baseEvent, cancelled: true, sequence: 2 }], origin);
    expect(property(initial, "UID")).toBe(property(edited, "UID"));
    expect(property(initial, "UID")).toBe(property(cancelled, "UID"));
    expect(property(cancelled, "STATUS")).toBe("STATUS:CANCELLED");
    expect(property(cancelled, "SEQUENCE")).toBe("SEQUENCE:2");
    expect(property(initial, "UID")).not.toBe(property(serializeCalendar("jidelnicek", [baseEvent], origin), "UID"));
  });

  it("uses calendar dates across DST, leap days, and year boundaries in any server timezone", () => {
    for (const timezone of ["UTC", "Europe/Prague", "America/Los_Angeles", "Pacific/Auckland"]) {
      vi.stubEnv("TZ", timezone);
      for (const [date, next] of [
        ["2026-03-29", "20260330"],
        ["2026-10-25", "20261026"],
        ["2028-02-28", "20280229"],
        ["2028-02-29", "20280301"],
        ["2026-12-31", "20270101"],
      ]) {
        const calendar = serializeCalendar("habitat", [{ ...baseEvent, date }], origin);
        expect(calendar).toContain(`DTSTART;VALUE=DATE:${date.replace(/-/g, "")}\r\nDTEND;VALUE=DATE:${next}\r\n`);
      }
    }
  });

  it("never embeds subscription paths, query strings, or credentials in the app URL", () => {
    const calendar = serializeCalendar("habitat", [baseEvent], "https://private-user:private-password@app.habitatzbraslav.cz/api/calendars/private-token/habitat.ics?secret=private-query");
    expect(property(calendar, "URL")).toBe(`URL:${origin}/`);
    expect(calendar).not.toMatch(/private-/);
  });

  it("produces deterministic snapshots independent of event input order", () => {
    const second = { ...baseEvent, id: "day:2026-11-11", date: "2026-11-11" };
    expect(serializeCalendar("habitat", [baseEvent, second], origin)).toBe(
      serializeCalendar("habitat", [second, baseEvent], origin),
    );
    expect(serializeCalendar("habitat", [], origin)).not.toContain("BEGIN:VEVENT");
  });

  it("rejects invalid dates and revision values instead of publishing malformed events", () => {
    expect(() => serializeCalendar("habitat", [{ ...baseEvent, date: "2026-02-30" }], origin)).toThrow("Invalid calendar date");
    expect(() => serializeCalendar("habitat", [{ ...baseEvent, sequence: -1 }], origin)).toThrow("Invalid calendar sequence");
    expect(() => serializeCalendar("habitat", [{ ...baseEvent, updatedAt: Number.NaN }], origin)).toThrow("Invalid calendar timestamp");
    expect(() => serializeCalendar("habitat", [baseEvent], "javascript:alert(1)")).toThrow("Invalid calendar application origin");
  });
});
