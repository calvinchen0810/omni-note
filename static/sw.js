const CACHE = "omni-note-v2";

const PRECACHE_RELATIVE = [
  "",
  "js/app.js",
  "js/store.js",
  "js/api.js",
  "js/canvas-utils.js",
  "js/export-utils.js",
  "js/components/Canvas.js",
  "js/components/Toolbar.js",
  "js/components/PageTabs.js",
  "js/components/StickyNote.js",
  "js/components/NotebookList.js",
  "manifest.json",
];

self.addEventListener("install", (e) => {
  const precacheUrls = PRECACHE_RELATIVE.map((p) => new URL(p, self.registration.scope).toString());
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(precacheUrls)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  const scopePath = new URL(self.registration.scope).pathname;
  const relativePath = url.pathname.startsWith(scopePath)
    ? url.pathname.slice(scopePath.length)
    : url.pathname.replace(/^\//, "");
  const normalizedPath = relativePath.replace(/^\//, "");

  // Always pass API requests to network
  if (normalizedPath.startsWith("api/")) {
    e.respondWith(fetch(e.request));
    return;
  }

  if (e.request.method !== "GET") {
    return;
  }

  // Keep code assets fresh to avoid stale JS/CSS after deployments.
  const isCodeAsset =
    normalizedPath === "" ||
    normalizedPath === "index.html" ||
    normalizedPath.startsWith("js/");
  if (isCodeAsset) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for static assets
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        if (res && res.status === 200 && e.request.method === "GET") {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
