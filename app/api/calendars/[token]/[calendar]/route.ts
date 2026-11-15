import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { hashCalendarToken } from "@/lib/calendar-subscription-token";
import { serializeCalendar } from "@/lib/ical";
import { getWorkOSBaseUrl } from "@/lib/workos-url";

export const runtime = "nodejs";

const privacyHeaders = {
  "Cache-Control": "private, no-cache, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(request: Request, context: { params: Promise<{ token: string; calendar: string }> }) {
  const { token, calendar } = await context.params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token) || (calendar !== "habitat.ics" && calendar !== "jidelnicek.ics")) {
    return new Response("Kalendář nenalezen.", { status: 404, headers: { ...privacyHeaders, "Cache-Control": "no-store" } });
  }
  try {
    const kind = calendar === "habitat.ics" ? "habitat" : "jidelnicek";
    const events = await db.calendarSubscriptions.readFeed(hashCalendarToken(token), kind);
    if (events === null) {
      return new Response("Kalendář nenalezen.", { status: 404, headers: { ...privacyHeaders, "Cache-Control": "no-store" } });
    }
    const body = serializeCalendar(kind, events, getWorkOSBaseUrl());
    const etag = `"${createHash("sha256").update(body).digest("hex")}"`;
    const headers = {
      ...privacyHeaders,
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${calendar}"`,
      ETag: etag,
    };
    // Authorization and revision publication always run before conditional GET.
    const matches = request.headers.get("if-none-match")?.split(",").some(value => value.trim().replace(/^W\//, "") === etag || value.trim() === "*");
    return new Response(matches ? null : body, { status: matches ? 304 : 200, headers });
  } catch {
    // Never return a successful empty feed after an outage: clients could delete events.
    console.error("Calendar feed temporarily unavailable");
    return new Response("Kalendář je dočasně nedostupný.", {
      status: 503,
      headers: { ...privacyHeaders, "Cache-Control": "no-store", "Retry-After": "300" },
    });
  }
}
