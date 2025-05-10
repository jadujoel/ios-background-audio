// service-worker.js

const CACHE_NAME = "model-cache-v1";

// Install event
self.addEventListener("install", (event) => {
	console.log("Service worker installed");
	self.skipWaiting();
});

// Activate event
self.addEventListener("activate", (event) => {
	event.waitUntil(
		// Remove old caches
		caches
			.keys()
			.then((cacheNames) =>
				Promise.all(
					cacheNames.map((cache) => {
						if (cache !== CACHE_NAME) {
							return caches.delete(cache);
						}
					}),
				),
			)
			.then(() => self.clients.claim()),
	);
});

// Fetch event
self.addEventListener("fetch", (event) => {
	const requestURL = new URL(event.request.url);
	if (
		requestURL.href.includes("cdn-lfs-us-1") ||
		requestURL.href.includes("huggingface") ||
    requestURL.href.includes("raw.githubusercontent.com/mlc-ai")
	) {
		// Handle requests to cdn-lfs-us-1.hf.co
		event.respondWith(
			caches.open(CACHE_NAME).then((cache) =>
				cache.match(event.request).then((response) => {
          if (response) {
            console.log("Cache hit", requestURL.href)
						// Return the cached response if present
						return response;
					}
          console.log("Cache miss", requestURL.href)
					// Fetch the resource from the network and cache it
					return fetch(event.request)
						.then((networkResponse) => {
							if (networkResponse && networkResponse.status === 200) {
								cache.put(event.request, networkResponse.clone());
							}
							return networkResponse;
						})
						.catch((error) => {
							console.error("Fetching failed:", error);
							throw error;
						});
				}),
			),
		);
	} else {
    console.log("Fetch", requestURL.href)
		// For other requests, proceed without caching
		event.respondWith(fetch(event.request));
	}
});
