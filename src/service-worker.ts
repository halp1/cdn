/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

// Intentionally minimal: this service worker exists so the app is installable
// as a PWA. There is no offline support and nothing is cached — every request
// falls through to the network, which keeps R2 range requests, streaming media
// and auth redirects behaving exactly as they do without a service worker.

const sw = self as unknown as ServiceWorkerGlobalScope;

sw.addEventListener("install", () => {
  sw.skipWaiting();
});

sw.addEventListener("activate", (event) => {
  event.waitUntil(sw.clients.claim());
});

// A fetch listener is required for installability in some browsers. It
// deliberately does not call `event.respondWith`, so the network handles it.
sw.addEventListener("fetch", () => {});

export {};
