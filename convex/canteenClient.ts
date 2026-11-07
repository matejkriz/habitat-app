import { DAY_MEAL_MAX_LENGTH } from "../lib/day-details";

const BASE_URL = "https://obedy.zss-zbraslav.cz/ejidelnicek/";
const ORIGIN = new URL(BASE_URL).origin;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;
const SNAPSHOT_TIMEOUT_MS = 5 * 60_000;
const DAY_MS = 86_400_000;

export type CanteenDay = { date: string; meal: string | null; mealCount: number };
export type CanteenErrorCode = "AUTH" | "NETWORK" | "PROTOCOL" | "CONFIG";

/** No upstream messages, request details, response bodies, or secrets leave this client. */
export class CanteenError extends Error {
  constructor(readonly code: CanteenErrorCode) {
    super({ AUTH: "Canteen authentication failed", NETWORK: "Canteen request failed", PROTOCOL: "Canteen response is invalid", CONFIG: "Canteen configuration is invalid" }[code]);
    this.name = "CanteenError";
  }
}

class SessionExpired extends Error {}
type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CanteenError("PROTOCOL");
  return value as JsonObject;
}

function integer(value: unknown, minimum = 0): number {
  const parsed = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isSafeInteger(parsed) || parsed < minimum) throw new CanteenError("PROTOCOL");
  return parsed;
}

const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", scaron: "š", Scaron: "Š", zcaron: "ž", Zcaron: "Ž", aacute: "á", Aacute: "Á", eacute: "é", Eacute: "É", iacute: "í", Iacute: "Í", oacute: "ó", Oacute: "Ó", uacute: "ú", Uacute: "Ú", yacute: "ý", Yacute: "Ý" };

function clean(value: unknown): string {
  if (value == null) return "";
  if (typeof value !== "string") throw new CanteenError("PROTOCOL");
  return value.replace(/<[^>]*>/g, "").replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity: string, name: string) => {
    if (!name.startsWith("#")) return entities[name] ?? entity;
    const code = name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1));
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : "";
  }).trim();
}

function dateNumber(value: unknown): number {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new CanteenError("PROTOCOL");
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) throw new CanteenError("PROTOCOL");
  return parsed;
}

function loginPage(body: string): boolean {
  return /(?:id\s*=\s*['"]loginForm['"]|name\s*=\s*['"]j_password['"])/i.test(body);
}

/** Read the JSON argument without evaluating any JavaScript supplied by the canteen. */
function publicMenu(body: string): JsonObject {
  for (const match of body.matchAll(/\bsetJidelnicek\s*\(\s*/g)) {
    const start = match.index! + match[0].length;
    if (body[start] !== "{") continue;
    let depth = 0;
    let quoted = false;
    let escaped = false;
    for (let index = start; index < body.length; index++) {
      const character = body[index];
      if (quoted) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') quoted = false;
      } else if (character === '"') quoted = true;
      else if (character === "{") depth++;
      else if (character === "}" && --depth === 0) {
        try {
          const parsed = object(JSON.parse(body.slice(start, index + 1)));
          object(parsed.stravaMap);
          return parsed;
        } catch { break; }
      }
    }
  }
  throw new CanteenError("PROTOCOL");
}

function lunch(menu: JsonObject): JsonObject | null {
  let found: JsonObject | null = null;
  for (const value of Object.values(object(menu.stravaMap))) {
    const meal = object(value);
    if (integer(meal.id, 1) !== 1) continue;
    if (found) throw new CanteenError("PROTOCOL");
    object(meal.denMap);
    found = meal;
  }
  return found;
}

function options(day: JsonObject): Map<number, JsonObject> {
  const result = new Map<number, JsonObject>();
  for (const value of Object.values(object(day.menuMap))) {
    const option = object(value);
    const id = integer(option.dbId, 1);
    if (result.has(id)) throw new CanteenError("PROTOCOL");
    result.set(id, option);
  }
  return result;
}

function mealForDay(date: string, dailyMenu: JsonObject, published: JsonObject): CanteenDay {
  const currentLunch = lunch(dailyMenu);
  if (!currentLunch) throw new CanteenError("PROTOCOL");
  const current = object(object(currentLunch.denMap)[date]);
  const available = options(current);
  const descriptions = options(published);
  if (available.size === 0 || [...descriptions.keys()].some(id => !available.has(id))) throw new CanteenError("PROTOCOL");
  let mealCount = 0;
  const names: string[] = [];
  for (const [id, option] of available) {
    const quantity = integer(option.objednavka);
    mealCount += quantity;
    if (!Number.isSafeInteger(mealCount)) throw new CanteenError("PROTOCOL");
    if (quantity === 0) continue;
    const name = clean(descriptions.get(id)?.nazev) || clean(option.nazev);
    if (!name) throw new CanteenError("PROTOCOL");
    names.push(name);
  }
  if (mealCount === 0) return { date, meal: null, mealCount: 0 };
  const soups = published.polevka ?? current.polevka ?? [];
  if (!Array.isArray(soups)) throw new CanteenError("PROTOCOL");
  const soupNames = soups.map(value => clean(object(value).polevka)).filter(Boolean);
  const meal = [...new Set([...soupNames, ...names])].join("\n");
  if (meal.length > DAY_MEAL_MAX_LENGTH) throw new CanteenError("PROTOCOL");
  return { date, meal, mealCount };
}

function allowedUrl(url: URL): boolean {
  return url.origin === ORIGIN && !url.username && !url.password && ["/ejidelnicek", "/ejidelnicek/", "/ejidelnicek/menu/", "/ejidelnicek/logincheck", "/ejidelnicek/visitor/index", "/ejidelnicek/ajax/get-jidelnicek"].includes(url.pathname);
}

class CanteenSession {
  private cookies = new Map<string, string>();

  constructor(private readonly username: string, private readonly password: string, private readonly fetchImpl: typeof fetch) {}

  private receiveCookies(headers: Headers) {
    const lines = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : (headers.get("set-cookie") ?? "").split(/,(?=\s*[^;,\s]+=)/);
    for (const line of lines) {
      const pair = /^([!#$%&'*+.^_`|~\w-]+)=([^;\x00-\x20\x7f]*)(?:;|$)/.exec(line.trim());
      if (!pair) continue;
      if (/;\s*max-age\s*=\s*0(?:;|$)/i.test(line)) this.cookies.delete(pair[1]);
      else this.cookies.set(pair[1], pair[2]);
    }
    if (this.cookies.size > 50) throw new CanteenError("PROTOCOL");
  }

  private async request(path: string, form?: URLSearchParams): Promise<string> {
    let url = new URL(path, BASE_URL);
    let method = form ? "POST" : "GET";
    let body = form?.toString();
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
    try {
      for (let redirects = 0; redirects <= 5; redirects++) {
        if (!allowedUrl(url)) throw new CanteenError("PROTOCOL");
        const headers: Record<string, string> = { "Cache-Control": "no-cache", Pragma: "no-cache" };
        if (body !== undefined) headers["Content-Type"] = "application/x-www-form-urlencoded";
        if (this.cookies.size) headers.Cookie = [...this.cookies].map(([key, value]) => `${key}=${value}`).join("; ");
        const response = await this.fetchImpl(url.toString(), { method, headers, body, redirect: "manual", signal: abort.signal });
        if (response.url && !allowedUrl(new URL(response.url))) throw new CanteenError("PROTOCOL");
        this.receiveCookies(response.headers);
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get("location");
          if (!location || redirects === 5) throw new CanteenError("PROTOCOL");
          const target = new URL(location, url);
          if (!allowedUrl(target)) throw new CanteenError("PROTOCOL");
          // Never replay the credential-bearing POST to a redirected endpoint.
          if (method === "POST" && [307, 308].includes(response.status)) throw new CanteenError("PROTOCOL");
          if (response.status === 303 || (method === "POST" && [301, 302].includes(response.status))) { method = "GET"; body = undefined; }
          await response.body?.cancel();
          url = target;
          continue;
        }
        if (response.status === 401 || response.status === 403) throw new SessionExpired();
        if (!response.ok) throw new CanteenError("NETWORK");
        if (Number(response.headers.get("content-length")) > MAX_RESPONSE_BYTES) throw new CanteenError("PROTOCOL");
        const reader = response.body?.getReader();
        if (!reader) return "";
        const decoder = new TextDecoder("utf-8", { fatal: true });
        let size = 0;
        let text = "";
        try {
          while (true) {
            let chunk: ReadableStreamReadResult<Uint8Array>;
            try { chunk = await reader.read(); }
            catch { throw new CanteenError("NETWORK"); }
            if (chunk.done) break;
            size += chunk.value.byteLength;
            if (size > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new CanteenError("PROTOCOL"); }
            text += decoder.decode(chunk.value, { stream: true });
          }
          return text + decoder.decode();
        } catch (error) {
          if (error instanceof CanteenError || abort.signal.aborted) throw error;
          throw new CanteenError("PROTOCOL");
        } finally { reader.releaseLock(); }
      }
      throw new CanteenError("PROTOCOL");
    } catch (error) {
      if (error instanceof CanteenError || error instanceof SessionExpired) throw error;
      throw new CanteenError("NETWORK");
    } finally { clearTimeout(timeout); abort.abort(); }
  }

  async publicMenu(): Promise<JsonObject> {
    try { return publicMenu(await this.request("menu/")); }
    catch (error) {
      if (error instanceof SessionExpired) throw new CanteenError("PROTOCOL");
      throw error;
    }
  }

  async login(): Promise<void> {
    this.cookies.clear();
    try {
      await this.request("");
      const body = await this.request("logincheck", new URLSearchParams({ j_username: this.username, j_password: this.password }));
      if (loginPage(body)) throw new CanteenError("AUTH");
    } catch (error) {
      if (error instanceof SessionExpired) throw new CanteenError("AUTH");
      throw error;
    }
  }

  async daily(date: string): Promise<JsonObject> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const body = await this.request(`ajax/get-jidelnicek?datum=${date}`);
        if (loginPage(body)) throw new SessionExpired();
        let parsed: JsonObject;
        try { parsed = object(JSON.parse(body)); }
        catch { throw new CanteenError("PROTOCOL"); }
        const menu = object(parsed.jidelnicek);
        object(menu.stravaMap);
        return menu;
      } catch (error) {
        if (!(error instanceof SessionExpired)) throw error;
        if (attempt) throw new CanteenError("AUTH");
        await this.login();
      }
    }
    throw new CanteenError("AUTH");
  }
}

export async function fetchCanteenDays({ username, password, dateFrom, dateTo }: {
  username: string; password: string; dateFrom: string; dateTo: string;
}, fetchImpl: typeof fetch = fetch): Promise<CanteenDay[]> {
  if (typeof username !== "string" || !username || username.length > 256 || typeof password !== "string" || !password || password.length > 4096) throw new CanteenError("CONFIG");
  let from: number;
  let to: number;
  try { from = dateNumber(dateFrom); to = dateNumber(dateTo); }
  catch { throw new CanteenError("CONFIG"); }
  if (to < from || to - from >= 31 * DAY_MS) throw new CanteenError("CONFIG");
  const deadline = Date.now() + SNAPSHOT_TIMEOUT_MS;
  const checkDeadline = () => { if (Date.now() >= deadline) throw new CanteenError("NETWORK"); };
  const session = new CanteenSession(username, password, fetchImpl);
  const publishedLunch = lunch(await session.publicMenu());
  if (!publishedLunch) return [];
  const dates: [string, JsonObject][] = [];
  for (const [date, value] of Object.entries(object(publishedLunch.denMap))) {
    const timestamp = dateNumber(date);
    if (timestamp < from || timestamp > to) continue;
    const day = object(value);
    if (options(day).size) dates.push([date, day]);
  }
  if (!dates.length) return [];
  dates.sort(([left], [right]) => left.localeCompare(right));
  checkDeadline();
  await session.login();
  const result: CanteenDay[] = [];
  for (const [date, day] of dates) {
    checkDeadline();
    const current = await session.daily(date);
    checkDeadline();
    result.push(mealForDay(date, current, day));
  }
  return result;
}
