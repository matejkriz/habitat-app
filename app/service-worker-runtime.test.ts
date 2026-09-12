import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const ORIGIN = "https://habitat.example";
const PUBLIC_CACHE = "habitat-public-v1";
const STATIC_CACHE = "habitat-static-v1";
const PRECACHE_URLS = [
  "/offline.html",
  "/habitat-logo.webp",
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/icon-maskable-192x192.png",
  "/icons/icon-maskable-512x512.png",
] as const;

type CacheKey = string | { readonly url: string };
type TestRequest = {
  readonly url: string;
  readonly method: string;
  readonly mode: RequestMode;
  readonly headers: Headers;
};
type WorkerEvent = {
  readonly request?: TestRequest;
  readonly preloadResponse?: Promise<Response | undefined>;
  readonly data?: { json(): unknown; text(): string };
  readonly notification?: {
    readonly data?: { readonly url?: string };
    close(): void;
  };
  waitUntil?(value: PromiseLike<unknown> | unknown): void;
  respondWith?(value: PromiseLike<Response> | Response): void;
};

const normalizeKey = (key: CacheKey): string =>
  new URL(typeof key === "string" ? key : key.url, ORIGIN).href;

class MemoryCache {
  readonly entries = new Map<string, Response>();

  async match(key: CacheKey): Promise<Response | undefined> {
    return this.entries.get(normalizeKey(key))?.clone();
  }

  async put(key: CacheKey, response: Response): Promise<void> {
    this.entries.set(normalizeKey(key), response.clone());
  }

  async delete(key: CacheKey): Promise<boolean> {
    return this.entries.delete(normalizeKey(key));
  }

  async keys(): Promise<ReadonlyArray<{ readonly url: string }>> {
    return Array.from(this.entries.keys(), (url) => ({ url }));
  }
}

function createRuntime() {
  const listeners = new Map<string, (event: WorkerEvent) => void>();
  const stores = new Map<string, MemoryCache>();
  const cacheStorage = {
    open: vi.fn(async (name: string) => {
      const existing = stores.get(name);
      if (existing) return existing;
      const cache = new MemoryCache();
      stores.set(name, cache);
      return cache;
    }),
    keys: vi.fn(async () => Array.from(stores.keys())),
    delete: vi.fn(async (name: string) => stores.delete(name)),
  };
  const network = vi.fn(async () => new Response("network", { status: 200 }));
  const skipWaiting = vi.fn(async () => undefined);
  const claim = vi.fn(async () => undefined);
  const enableNavigationPreload = vi.fn(async () => undefined);
  const worker = {
    location: { origin: ORIGIN },
    addEventListener: (
      type: string,
      listener: (event: WorkerEvent) => void,
    ) => listeners.set(type, listener),
    skipWaiting,
    clients: {
      claim,
      matchAll: vi.fn(async () => []),
      openWindow: vi.fn(async () => undefined),
    },
    registration: {
      navigationPreload: { enable: enableNavigationPreload },
      showNotification: vi.fn(async () => undefined),
    },
  };

  const source = readFileSync("public/sw.js", "utf8");
  const initialize = new Function("self", "caches", "fetch", "URL", source);
  initialize(worker, cacheStorage, network, URL);

  const dispatchExtendable = async (type: "install" | "activate") => {
    let pending: Promise<unknown> | undefined;
    listeners.get(type)?.({
      waitUntil: (value) => {
        pending = Promise.resolve(value);
      },
    });
    await pending;
  };

  const dispatchFetch = (request: TestRequest) => {
    let response: Promise<Response> | undefined;
    listeners.get("fetch")?.({
      request,
      preloadResponse: Promise.resolve(undefined),
      respondWith: (value) => {
        response = Promise.resolve(value);
      },
    });
    return response;
  };

  return {
    cacheStorage,
    claim,
    dispatchExtendable,
    dispatchFetch,
    enableNavigationPreload,
    network,
    skipWaiting,
    stores,
  };
}

function request(
  path: string,
  options: {
    readonly method?: string;
    readonly mode?: RequestMode;
    readonly headers?: HeadersInit;
  } = {},
): TestRequest {
  return {
    url: new URL(path, ORIGIN).href,
    method: options.method ?? "GET",
    mode: options.mode ?? "cors",
    headers: new Headers(options.headers),
  };
}

describe("service worker cache policy", () => {
  it("precaches only the explicit public shell", async () => {
    const runtime = createRuntime();

    await runtime.dispatchExtendable("install");

    expect(runtime.skipWaiting).toHaveBeenCalledOnce();
    expect(Array.from(runtime.stores.keys())).toEqual([PUBLIC_CACHE]);
    expect(
      Array.from(runtime.stores.get(PUBLIC_CACHE)?.entries.keys() ?? []).sort(),
    ).toEqual(PRECACHE_URLS.map((url) => new URL(url, ORIGIN).href).sort());
  });

  it("removes legacy app caches but preserves current and unrelated caches", async () => {
    const runtime = createRuntime();
    for (const name of [
      PUBLIC_CACHE,
      STATIC_CACHE,
      "habitat-public-v0",
      "pages",
      "pages-rsc",
      "serwist-precache-v1",
      "unrelated-library-cache",
    ]) {
      await runtime.cacheStorage.open(name);
    }

    await runtime.dispatchExtendable("activate");

    expect(Array.from(runtime.stores.keys()).sort()).toEqual(
      [PUBLIC_CACHE, STATIC_CACHE, "unrelated-library-cache"].sort(),
    );
    expect(runtime.enableNavigationPreload).toHaveBeenCalledOnce();
    expect(runtime.claim).toHaveBeenCalledOnce();
  });

  it("uses the network for navigations and the shell only on network failure", async () => {
    const runtime = createRuntime();
    const publicCache = await runtime.cacheStorage.open(PUBLIC_CACHE);
    await publicCache.put("/offline.html", new Response("offline shell"));
    runtime.network.mockResolvedValueOnce(new Response("dashboard"));

    const onlineResponse = runtime.dispatchFetch(
      request("/", { mode: "navigate" }),
    );
    expect(onlineResponse).toBeDefined();
    await expect(onlineResponse?.then((response) => response.text())).resolves.toBe(
      "dashboard",
    );
    expect(await publicCache.match("/")).toBeUndefined();

    runtime.network.mockRejectedValueOnce(new Error("offline"));
    const offlineResponse = runtime.dispatchFetch(
      request("/rodic", { mode: "navigate" }),
    );
    await expect(offlineResponse?.then((response) => response.text())).resolves.toBe(
      "offline shell",
    );
    expect(await publicCache.match("/rodic")).toBeUndefined();
  });

  it("does not intercept RSC, API, auth, image, action, or cross-origin requests", () => {
    const runtime = createRuntime();
    const ignored = [
      request("/?_rsc=abc", { headers: { RSC: "1" } }),
      request("/api/mcp"),
      request("/login"),
      request("/_next/image?url=%2Fhabitat-logo.webp"),
      request("/", { method: "POST", headers: { "Next-Action": "action-id" } }),
      request("https://api.example/data"),
    ];

    for (const ignoredRequest of ignored) {
      expect(runtime.dispatchFetch(ignoredRequest)).toBeUndefined();
    }
    expect(runtime.network).not.toHaveBeenCalled();
  });

  it("caches only successful immutable Next static responses", async () => {
    const runtime = createRuntime();
    runtime.network.mockResolvedValueOnce(
      new Response("chunk", {
        status: 200,
        headers: { "Cache-Control": "public, max-age=31536000, immutable" },
      }),
    );

    const chunkRequest = request("/_next/static/chunks/app-abc.js");
    const firstResponse = runtime.dispatchFetch(chunkRequest);
    await expect(firstResponse?.then((response) => response.text())).resolves.toBe(
      "chunk",
    );
    expect(
      await runtime.stores.get(STATIC_CACHE)?.match(chunkRequest),
    ).toBeDefined();

    runtime.network.mockClear();
    const cachedResponse = runtime.dispatchFetch(chunkRequest);
    await expect(cachedResponse?.then((response) => response.text())).resolves.toBe(
      "chunk",
    );
    expect(runtime.network).not.toHaveBeenCalled();

    const mutableRequest = request("/_next/static/chunks/dev.js");
    runtime.network.mockResolvedValueOnce(
      new Response("mutable", { headers: { "Cache-Control": "no-cache" } }),
    );
    await runtime.dispatchFetch(mutableRequest);
    expect(
      await runtime.stores.get(STATIC_CACHE)?.match(mutableRequest),
    ).toBeUndefined();

    const failedRequest = request("/_next/static/chunks/failed.js");
    runtime.network.mockResolvedValueOnce(
      new Response("failure", {
        status: 500,
        headers: { "Cache-Control": "public, max-age=31536000, immutable" },
      }),
    );
    await runtime.dispatchFetch(failedRequest);
    expect(
      await runtime.stores.get(STATIC_CACHE)?.match(failedRequest),
    ).toBeUndefined();

    const redirectedRequest = request("/_next/static/chunks/redirected.js");
    const redirected = new Response("redirected", {
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    });
    Object.defineProperty(redirected, "redirected", { value: true });
    runtime.network.mockResolvedValueOnce(redirected);
    await runtime.dispatchFetch(redirectedRequest);
    expect(
      await runtime.stores.get(STATIC_CACHE)?.match(redirectedRequest),
    ).toBeUndefined();
  });

  it("still serves a static network response when CacheStorage is full", async () => {
    const runtime = createRuntime();
    const staticCache = await runtime.cacheStorage.open(STATIC_CACHE);
    vi.spyOn(staticCache, "put").mockRejectedValueOnce(new Error("quota exceeded"));
    runtime.network.mockResolvedValueOnce(
      new Response("fresh chunk", {
        headers: { "Cache-Control": "public, max-age=31536000, immutable" },
      }),
    );

    const response = runtime.dispatchFetch(
      request("/_next/static/chunks/fresh.js"),
    );

    await expect(response?.then((value) => value.text())).resolves.toBe(
      "fresh chunk",
    );
  });
});
