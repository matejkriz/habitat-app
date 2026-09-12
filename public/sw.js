"use strict";

const PUBLIC_CACHE_NAME = "habitat-public-v1";
const STATIC_CACHE_NAME = "habitat-static-v1";
const OFFLINE_URL = "/offline.html";
const NEXT_STATIC_PREFIX = "/_next/static/";
const MAX_STATIC_ENTRIES = 128;
const PUBLIC_ASSETS = [
  OFFLINE_URL,
  "/habitat-logo.webp",
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/icon-maskable-192x192.png",
  "/icons/icon-maskable-512x512.png",
];
const PUBLIC_ASSET_PATHS = new Set(PUBLIC_ASSETS);
const CURRENT_CACHES = new Set([PUBLIC_CACHE_NAME, STATIC_CACHE_NAME]);
const LEGACY_SERWIST_CACHES = new Set([
  "apis",
  "cross-origin",
  "google-fonts-stylesheets",
  "google-fonts-webfonts",
  "next-data",
  "next-image",
  "next-static-js-assets",
  "others",
  "pages",
  "pages-rsc",
  "pages-rsc-prefetch",
  "static-audio-assets",
  "static-data-assets",
  "static-font-assets",
  "static-image-assets",
  "static-js-assets",
  "static-style-assets",
  "static-video-assets",
]);

function isSafeResponse(response, requestedUrl, requireImmutable = false) {
  if (!response?.ok || response.redirected) return false;

  const responseUrl = new URL(response.url || requestedUrl.href);
  if (responseUrl.origin !== self.location.origin) return false;

  return (
    !requireImmutable ||
    response.headers.get("Cache-Control")?.includes("immutable") === true
  );
}

async function precachePublicAssets() {
  const cache = await caches.open(PUBLIC_CACHE_NAME);
  await Promise.all(
    PUBLIC_ASSETS.map(async (path) => {
      const url = new URL(path, self.location.origin);
      const response = await fetch(url.href, {
        cache: "reload",
        credentials: "same-origin",
      });
      if (!isSafeResponse(response, url)) {
        throw new Error(`Nelze uložit veřejný PWA asset: ${path}`);
      }
      await cache.put(path, response.clone());
    }),
  );
}

function shouldDeleteCache(name) {
  if (CURRENT_CACHES.has(name)) return false;
  return (
    name.startsWith("habitat-") ||
    name.startsWith("serwist-precache-") ||
    LEGACY_SERWIST_CACHES.has(name)
  );
}

async function activateWorker() {
  const cacheNames = await caches.keys();
  const cleanup = cacheNames
    .filter(shouldDeleteCache)
    .map((name) => caches.delete(name));
  const navigationPreload = self.registration.navigationPreload?.enable
    ? Promise.resolve(self.registration.navigationPreload.enable()).catch(
        () => undefined,
      )
    : Promise.resolve();

  await Promise.all([...cleanup, navigationPreload]);
  await self.clients.claim();
}

async function handleNavigation(event) {
  try {
    const preloaded = await event.preloadResponse;
    return preloaded || (await fetch(event.request));
  } catch {
    const cache = await caches.open(PUBLIC_CACHE_NAME);
    const offline = await cache.match(OFFLINE_URL);
    return (
      offline ||
      new Response("Aplikace je offline.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  }
}

async function handlePublicAsset(request, url) {
  const cache = await caches.open(PUBLIC_CACHE_NAME);
  const cached = await cache.match(url.pathname);
  if (cached) return cached;

  const response = await fetch(request);
  if (isSafeResponse(response, url)) {
    try {
      await cache.put(url.pathname, response.clone());
    } catch {
      // A cache quota failure must not block a valid network response.
    }
  }
  return response;
}

async function trimStaticCache(cache) {
  const keys = await cache.keys();
  const staleKeys = keys.slice(0, Math.max(0, keys.length - MAX_STATIC_ENTRIES));
  await Promise.all(staleKeys.map((key) => cache.delete(key)));
}

async function handleNextStatic(request, url) {
  const cache = await caches.open(STATIC_CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (isSafeResponse(response, url, true)) {
    try {
      await cache.put(request, response.clone());
      await trimStaticCache(cache);
    } catch {
      // A cache quota failure must not block a valid network response.
    }
  }
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(Promise.all([precachePublicAssets(), self.skipWaiting()]));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(activateWorker());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(event));
    return;
  }

  if (url.search === "" && PUBLIC_ASSET_PATHS.has(url.pathname)) {
    event.respondWith(handlePublicAsset(request, url));
    return;
  }

  if (url.pathname.startsWith(NEXT_STATIC_PREFIX)) {
    event.respondWith(handleNextStatic(request, url));
  }
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = { body: event.data?.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "Habitat Docházka", {
      body: payload.body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      tag: payload.tag,
      data: { url: payload.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(
    event.notification.data?.url || "/",
    self.location.origin,
  ).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clients) => {
        for (const client of clients) {
          if ("navigate" in client) await client.navigate(targetUrl);
          return client.focus();
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});
