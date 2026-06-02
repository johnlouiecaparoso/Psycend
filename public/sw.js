const APP_SHELL_CACHE = "psycend-app-shell-v5";
const PAGE_CACHE = "psycend-pages-v5";
const DATA_CACHE = "psycend-data-v5";
const OFFLINE_URL = "/offline";
const LAST_PAGE_FALLBACK_KEY = "/__offline-last-page__";
const IS_DEV_HOST =
  self.location.hostname === "localhost" ||
  self.location.hostname === "127.0.0.1" ||
  self.location.hostname === "0.0.0.0";
const STATIC_ASSETS = [
  "/",
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/app.png"
];

function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest";
}

function isRouteDataRequest(url) {
  return url.searchParams.has("_rsc") || url.pathname.startsWith("/_next/");
}

async function rememberLastPage(request, response) {
  if (!response || response.status !== 200) {
    return;
  }

  const requestUrl = new URL(request.url);
  if (requestUrl.pathname === OFFLINE_URL) {
    return;
  }

  const cache = await caches.open(PAGE_CACHE);
  await cache.put(LAST_PAGE_FALLBACK_KEY, response.clone());
}

self.addEventListener("install", (event) => {
  if (IS_DEV_HOST) {
    self.skipWaiting();
    return;
  }

  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  if (IS_DEV_HOST) {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(
          keys.filter((key) => key.startsWith("psycend-")).map((key) => caches.delete(key))
        )
      )
    );
    self.clients.claim();
    return;
  }

  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![APP_SHELL_CACHE, PAGE_CACHE, DATA_CACHE].includes(key))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (IS_DEV_HOST) {
    return;
  }

  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const pageCache = await caches.open(PAGE_CACHE);
        const cachedPage = await pageCache.match(event.request);

        const networkPromise = fetch(event.request)
          .then(async (response) => {
            if (response && response.status === 200) {
              await pageCache.put(event.request, response.clone());
              await rememberLastPage(event.request, response.clone());
            }

            return response;
          })
          .catch(() => null);

        if (cachedPage) {
          void networkPromise;
          return cachedPage;
        }

        const networkResponse = await networkPromise;
        if (networkResponse) {
          return networkResponse;
        }

        const lastKnownPage = await pageCache.match(LAST_PAGE_FALLBACK_KEY);
        if (requestUrl.pathname === "/") {
          return lastKnownPage || caches.match(OFFLINE_URL);
        }

        return lastKnownPage || caches.match(OFFLINE_URL);
      })()
    );
    return;
  }

  if (isStaticAsset(requestUrl)) {
    event.respondWith(
      caches.match(event.request).then(async (cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        const networkResponse = await fetch(event.request);
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(APP_SHELL_CACHE).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      })
    );
    return;
  }

  if (isRouteDataRequest(requestUrl)) {
    event.respondWith(
      (async () => {
        const dataCache = await caches.open(DATA_CACHE);
        const cachedResponse = await dataCache.match(event.request);

        const networkPromise = fetch(event.request)
          .then(async (networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              await dataCache.put(event.request, networkResponse.clone());
            }

            return networkResponse;
          })
          .catch(() => null);

        if (cachedResponse) {
          void networkPromise;
          return cachedResponse;
        }

        const networkResponse = await networkPromise;
        if (networkResponse) {
          return networkResponse;
        }

        return new Response("", {
          status: 204,
          headers: {
            "Content-Type": "text/plain"
          }
        });
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const dataCache = await caches.open(DATA_CACHE);
      const cachedResponse = await dataCache.match(event.request);

      const networkPromise = fetch(event.request)
        .then(async (networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            await dataCache.put(event.request, networkResponse.clone());
          }

          return networkResponse;
        })
        .catch(() => null);

      if (cachedResponse) {
        void networkPromise;
        return cachedResponse;
      }

      const networkResponse = await networkPromise;
      if (networkResponse) {
        return networkResponse;
      }

      return caches.match(OFFLINE_URL);
    })()
  );
});
