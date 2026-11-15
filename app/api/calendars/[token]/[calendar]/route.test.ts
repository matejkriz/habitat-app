import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const readFeed = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db: { calendarSubscriptions: { readFeed } } }));
import { GET } from "./route";

const token = "t".repeat(43);
const event = { id: "habitat:2026-11-10", date: "2026-11-10", summary: "Výlet", updatedAt: 1794268800000, sequence: 0, cancelled: false };
function request(calendar = "habitat.ics", value = token, etag?: string) {
  return GET(new Request(`https://app.example/api/calendars/${value}/${calendar}`, {
    headers: etag ? { "If-None-Match": etag } : {},
  }), { params: Promise.resolve({ token: value, calendar }) });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_WORKOS_REDIRECT_URI", "https://developapp.habitatzbraslav.cz/callback");
  readFeed.mockResolvedValue([event]);
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("read-only calendar HTTP subscription", () => {
  it("serves an iCalendar response without login and sends only a hash to the backend", async () => {
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe('inline; filename="habitat.ics"');
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    expect(response.headers.get("cache-control")).toContain("private");
    expect(readFeed).toHaveBeenCalledWith(expect.stringMatching(/^[a-f0-9]{64}$/), "habitat");
    const body = await response.text();
    expect(body).toContain("BEGIN:VCALENDAR\r\n");
    expect(body).toContain("SUMMARY:Výlet\r\n");
    expect(body).not.toContain(token);
    await request("jidelnicek.ics");
    expect(readFeed).toHaveBeenLastCalledWith(expect.any(String), "jidelnicek");
  });

  it("revalidates data and token before returning 304, and refuses revoked tokens even with an old ETag", async () => {
    const initial = await request();
    const etag = initial.headers.get("etag")!;
    expect((await request("habitat.ics", token, `W/${etag}`)).status).toBe(304);
    expect(readFeed).toHaveBeenCalledTimes(2);
    readFeed.mockResolvedValue(null);
    const revoked = await request("habitat.ics", token, etag);
    expect(revoked.status).toBe(404);
    expect(revoked.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects malformed tokens and unknown calendars before a database call", async () => {
    expect((await request("habitat.ics", "bad")).status).toBe(404);
    expect((await request("children.ics")).status).toBe(404);
    expect(readFeed).not.toHaveBeenCalled();
  });

  it("returns a retryable error rather than an empty calendar after a backend failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    readFeed.mockRejectedValue(new Error("internal connection details"));
    const response = await request();
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("300");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).not.toContain("internal connection details");
  });
});
