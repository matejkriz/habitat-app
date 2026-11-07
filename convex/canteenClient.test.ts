// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { CanteenError, fetchCanteenDays } from "./canteenClient";

const FIRST = "2026-11-09";
const SECOND = "2026-11-10";
const input = { username: "fixture-user", password: "fixture-password-do-not-expose", dateFrom: FIRST, dateTo: SECOND };
const login = '<form id="loginForm"><input name="j_password"></form>';
type Menu = ReturnType<typeof menu>;

function menu(selected: string | null = null, quantity: unknown = 6) {
  return { stravaMap: {
    "unrelated-map-key": { id: 1, nazev: "Oběd", denMap: Object.fromEntries([FIRST, SECOND].map(date => [date, {
      polevka: [{ polevka: "Hrášková&nbsp;polévka", alergZobr: "7" }],
      menuMap: {
        arbitrary: { dbId: 7, dMenu: "1", nazev: "<b>Kuře</b> s brambory &amp; salátem", objednavka: selected === date ? quantity : 0 },
        other: { dbId: 8, dMenu: "2", nazev: "Zeleninové rizoto", objednavka: 0 },
      },
    }])) },
    breakfast: { id: 2, nazev: "Snídaně", denMap: {} },
  } };
}

function fixture(options: {
  published?: Menu;
  changeDaily?: (menu: Menu, date: string) => void;
  expire?: number;
  rejectLogin?: boolean;
  redirect?: string;
  redirectStatus?: number;
} = {}) {
  const calls: { url: URL; init?: RequestInit }[] = [];
  let logins = 0;
  let expirations = options.expire ?? 0;
  const fetchImpl = vi.fn(async (target: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(target));
    calls.push({ url, init });
    if (url.pathname.endsWith("/menu/")) return new Response(`<script>client.setJidelnicek(${JSON.stringify(options.published ?? menu())});</script>`);
    if (url.pathname.endsWith("/logincheck")) {
      logins++;
      if (options.redirect) return new Response(null, { status: options.redirectStatus ?? 302, headers: { location: options.redirect, "set-cookie": "JSESSIONID=rotated; Path=/ejidelnicek/; Secure; HttpOnly" } });
      return new Response(options.rejectLogin ? login : 'new Ejidelnicek("ajax/", true, {});', { headers: { "set-cookie": "JSESSIONID=authenticated; Path=/ejidelnicek/; Secure; HttpOnly" } });
    }
    if (url.pathname.endsWith("/ajax/get-jidelnicek")) {
      if (expirations-- > 0) return new Response(login);
      const date = url.searchParams.get("datum")!;
      const current = menu(date, date === FIRST ? 6 : 4);
      options.changeDaily?.(current, date);
      return new Response(JSON.stringify({ jidelnicek: current, stravnik: { hromadny: true, pin: "PRIVATE-PIN", jmeno: "PRIVATE-NAME", saldo: "PRIVATE-BALANCE" } }));
    }
    if (url.pathname === "/ejidelnicek/visitor/index") return new Response('new Ejidelnicek("ajax/", true, {});');
    if (url.pathname === "/ejidelnicek/") return new Response(logins ? "Authenticated home" : login, { headers: { "set-cookie": "JSESSIONID=initial; Path=/ejidelnicek/; Secure; HttpOnly" } });
    throw new Error("Unexpected fixture route");
  });
  return { calls, fetchImpl: fetchImpl as typeof fetch, logins: () => logins };
}

function selected(current: Menu, date: string) {
  return current.stravaMap["unrelated-map-key"].denMap[date];
}

afterEach(() => vi.useRealTimers());

describe("read-only canteen client", () => {
  it("uses authenticated quantities, complete public descriptions and all ordered lunch variants", async () => {
    const fake = fixture({ changeDaily(current, date) {
      selected(current, date).menuMap.arbitrary.nazev = "Kuře";
      selected(current, date).menuMap.other.objednavka = date === FIRST ? 2 : 0;
    } });
    expect(await fetchCanteenDays(input, fake.fetchImpl)).toEqual([
      { date: FIRST, meal: "Hrášková polévka\nKuře s brambory & salátem\nZeleninové rizoto", mealCount: 8 },
      { date: SECOND, meal: "Hrášková polévka\nKuře s brambory & salátem", mealCount: 4 },
    ]);
    expect(fake.logins()).toBe(1);
    const post = fake.calls.find(call => call.init?.method === "POST")!;
    expect(new URLSearchParams(String(post.init?.body)).get("j_password")).toBe(input.password);
    expect(new Headers(post.init?.headers).get("Cookie")).toBe("JSESSIONID=initial");
    const daily = fake.calls.filter(call => call.url.pathname.endsWith("get-jidelnicek"));
    expect(daily).toHaveLength(2);
    expect(daily.every(call => new Headers(call.init?.headers).get("Cookie") === "JSESSIONID=authenticated")).toBe(true);
    expect(fake.calls.every(call => !call.url.pathname.includes("menu-update") && call.url.origin === "https://obedy.zss-zbraslav.cz")).toBe(true);
  });

  it("returns confirmed zero orders without a soup or menu placeholder", async () => {
    const fake = fixture({ changeDaily(current, date) { selected(current, date).menuMap.arbitrary.objednavka = 0; } });
    expect(await fetchCanteenDays(input, fake.fetchImpl)).toEqual([
      { date: FIRST, meal: null, mealCount: 0 }, { date: SECOND, meal: null, mealCount: 0 },
    ]);
  });

  it("skips unpublished dates and never invents zero orders", async () => {
    const fake = fixture();
    expect(await fetchCanteenDays({ ...input, dateFrom: "2026-11-11", dateTo: "2026-11-12" }, fake.fetchImpl)).toEqual([]);
    expect(fake.calls).toHaveLength(1);
    expect(fake.logins()).toBe(0);
    const published = menu();
    published.stravaMap["unrelated-map-key"].denMap = {};
    expect(await fetchCanteenDays(input, fixture({ published }).fetchImpl)).toEqual([]);
  });

  it("rejects missing selected days and partial authenticated menu variants", async () => {
    const missing = fixture({ changeDaily(current, date) { delete current.stravaMap["unrelated-map-key"].denMap[date]; } });
    await expect(fetchCanteenDays(input, missing.fetchImpl)).rejects.toMatchObject({ code: "PROTOCOL" });
    const partial = fixture({ changeDaily(current, date) { delete (selected(current, date).menuMap as Record<string, unknown>).other; } });
    await expect(fetchCanteenDays(input, partial.fetchImpl)).rejects.toMatchObject({ code: "PROTOCOL" });
  });

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1, "unknown", null, true])("rejects invalid authoritative quantities: %s", async quantity => {
    const fake = fixture({ changeDaily(current, date) { selected(current, date).menuMap.arbitrary.objednavka = quantity; } });
    await expect(fetchCanteenDays(input, fake.fetchImpl)).rejects.toMatchObject({ code: "PROTOCOL" });
  });

  it("accepts integer strings and rejects totals outside the safe range", async () => {
    const strings = fixture({ changeDaily(current, date) { selected(current, date).menuMap.arbitrary.objednavka = "3"; } });
    expect((await fetchCanteenDays(input, strings.fetchImpl))[0].mealCount).toBe(3);
    const overflowing = fixture({ changeDaily(current, date) {
      selected(current, date).menuMap.arbitrary.objednavka = Number.MAX_SAFE_INTEGER;
      selected(current, date).menuMap.other.objednavka = 1;
    } });
    await expect(fetchCanteenDays(input, overflowing.fetchImpl)).rejects.toMatchObject({ code: "PROTOCOL" });
  });

  it("renews an expired session once and stops after repeated expiry", async () => {
    const renewed = fixture({ expire: 1 });
    expect((await fetchCanteenDays(input, renewed.fetchImpl))[0].mealCount).toBe(6);
    expect(renewed.logins()).toBe(2);
    const expired = fixture({ expire: 3 });
    await expect(fetchCanteenDays(input, expired.fetchImpl)).rejects.toMatchObject({ code: "AUTH" });
    expect(expired.logins()).toBe(2);
  });

  it("stops before private reads when login is rejected", async () => {
    const fake = fixture({ rejectLogin: true });
    await expect(fetchCanteenDays(input, fake.fetchImpl)).rejects.toMatchObject({ code: "AUTH" });
    expect(fake.calls.some(call => call.url.pathname.includes("ajax/"))).toBe(false);
  });

  it("follows a same-origin login redirect using GET and rotated session cookies", async () => {
    const fake = fixture({ redirect: "/ejidelnicek/" });
    expect((await fetchCanteenDays(input, fake.fetchImpl))[0].mealCount).toBe(6);
    const redirected = fake.calls.find(call => call.url.pathname === "/ejidelnicek/" && new Headers(call.init?.headers).get("Cookie") === "JSESSIONID=rotated");
    expect(redirected?.init?.method).toBe("GET");
    expect(redirected?.init?.body).toBeUndefined();
  });

  it("follows the actual login redirect to visitor/index without resending credentials", async () => {
    const fake = fixture({ redirect: "/ejidelnicek/visitor/index" });
    expect((await fetchCanteenDays(input, fake.fetchImpl))[0].mealCount).toBe(6);
    const redirected = fake.calls.find(call => call.url.pathname === "/ejidelnicek/visitor/index")!;
    expect(redirected.init?.method).toBe("GET");
    expect(redirected.init?.body).toBeUndefined();
    expect(new Headers(redirected.init?.headers).get("Cookie")).toBe("JSESSIONID=rotated");
    const daily = fake.calls.find(call => call.url.pathname.endsWith("get-jidelnicek"))!;
    expect(new Headers(daily.init?.headers).get("Cookie")).toBe("JSESSIONID=rotated");
  });

  it.each([
    ["https://outside.example/collect", 302],
    ["http://obedy.zss-zbraslav.cz/ejidelnicek/", 302],
    ["https://user:password@obedy.zss-zbraslav.cz/ejidelnicek/", 302],
    ["/ejidelnicek/ajax/menu-update?ordered=0", 302],
    ["/ejidelnicek/", 307],
  ])("rejects redirects which could expose secrets or trigger a write: %s", async (redirect, redirectStatus) => {
    const fake = fixture({ redirect, redirectStatus });
    await expect(fetchCanteenDays(input, fake.fetchImpl)).rejects.toMatchObject({ code: "PROTOCOL" });
    expect(fake.calls).toHaveLength(3);
  });

  it("never exposes upstream errors or personal account fields", async () => {
    const fake = fixture();
    const result = await fetchCanteenDays(input, fake.fetchImpl);
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE|fixture-user|fixture-password|JSESSIONID/);
    const failing = vi.fn().mockRejectedValue(new Error(`private ${input.password} JSESSIONID=secret`)) as typeof fetch;
    const error = await fetchCanteenDays(input, failing).catch(error => error);
    expect(error).toBeInstanceOf(CanteenError);
    expect(error).toMatchObject({ code: "NETWORK" });
    expect(String(error)).not.toMatch(/private|fixture-password|JSESSIONID/);
    expect(error.cause).toBeUndefined();
  });

  it("bounds both declared and streamed response lengths", async () => {
    const declared = vi.fn(async () => new Response("small", { headers: { "content-length": String(4 * 1024 * 1024 + 1) } })) as typeof fetch;
    await expect(fetchCanteenDays(input, declared)).rejects.toMatchObject({ code: "PROTOCOL" });
    const streamed = vi.fn(async () => new Response(new Uint8Array(4 * 1024 * 1024 + 1))) as typeof fetch;
    await expect(fetchCanteenDays(input, streamed)).rejects.toMatchObject({ code: "PROTOCOL" });
  });

  it("aborts a request after its timeout without forwarding the rejection reason", async () => {
    vi.useFakeTimers();
    const pending = vi.fn((_target, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error(input.password)), { once: true });
    })) as typeof fetch;
    const result = fetchCanteenDays(input, pending).catch(error => error);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await result).toMatchObject({ code: "NETWORK", message: "Canteen request failed" });
  });

  it("classifies an interrupted response stream as a retryable network error", async () => {
    const interrupted = vi.fn(async () => new Response(new ReadableStream({
      start(controller) { controller.error(new Error("private upstream failure")); },
    }))) as typeof fetch;
    await expect(fetchCanteenDays(input, interrupted)).rejects.toMatchObject({ code: "NETWORK", message: "Canteen request failed" });
  });

  it("rejects an over-budget snapshot without returning already read days", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-09T08:00:00Z"));
    const fake = fixture();
    const slow = (async (target, init) => {
      const response = await fake.fetchImpl(target, init);
      // Move wall time without firing request timers: each successful daily read
      // represents a slow request plus session renewal work.
      if (String(target).includes("get-jidelnicek")) vi.setSystemTime(Date.now() + 160_000);
      return response;
    }) as typeof fetch;
    await expect(fetchCanteenDays(input, slow)).rejects.toMatchObject({ code: "NETWORK", message: "Canteen request failed" });
    expect(fake.calls.filter(call => call.url.pathname.endsWith("get-jidelnicek"))).toHaveLength(2);
  });

  it("checks the snapshot deadline before sending credentials", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-09T08:00:00Z"));
    const fake = fixture();
    const slow = (async (target, init) => {
      const response = await fake.fetchImpl(target, init);
      vi.setSystemTime(Date.now() + 300_000);
      return response;
    }) as typeof fetch;
    await expect(fetchCanteenDays(input, slow)).rejects.toMatchObject({ code: "NETWORK" });
    expect(fake.calls).toHaveLength(1);
    expect(fake.logins()).toBe(0);
  });

  it("parses nested JSON and quoted braces without executing JavaScript", async () => {
    const published = menu();
    selected(published, FIRST).menuMap.arbitrary.nazev = 'Kuře "}\\" s rýží';
    const fake = fixture({ published });
    expect((await fetchCanteenDays(input, fake.fetchImpl))[0].meal).toContain('Kuře "}\\" s rýží');
    const script = vi.fn(async () => new Response("setJidelnicek(globalThis.doNotExecute());")) as typeof fetch;
    await expect(fetchCanteenDays(input, script)).rejects.toMatchObject({ code: "PROTOCOL" });
  });

  it.each([
    { dateFrom: "2026-02-30" }, { dateTo: "2026-11-08" }, { dateTo: "2026-12-10" }, { username: "" }, { password: "" },
  ])("validates inputs before making requests: %s", async patch => {
    const fake = fixture();
    await expect(fetchCanteenDays({ ...input, ...patch }, fake.fetchImpl)).rejects.toMatchObject({ code: "CONFIG" });
    expect(fake.calls).toHaveLength(0);
  });
});
