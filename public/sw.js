// خدمة عامل (Service Worker) لتطبيق "نسب" — تشغيل بدون إنترنت + تثبيت كتطبيق.
// استراتيجية بسيطة لا تحتاج قائمة ملفات مبنية وقت البناء:
//   - صفحات التنقّل (navigation): الشبكة أولًا، ثم النسخة المخزّنة، ثم الصفحة
//     الرئيسية المخزّنة كحل أخير.
//   - الأصول الثابتة (JS/CSS/صور/خطوط) من نفس الأصل: تُقدَّم من المخزن فورًا
//     مع تحديثها في الخلفية (stale-while-revalidate).
//   - لا تُخزَّن مسارات API/المصادقة الديناميكية.

const CACHE_VERSION = "nasab-shell-v1";
const RUNTIME_CACHE = "nasab-runtime-v1";

const SKIP_PATH_PREFIXES = ["/api/", "/auth/", "/__grok/", "/@", "/node_modules"];

function shouldBypass(url) {
  return SKIP_PATH_PREFIXES.some((p) => url.pathname.startsWith(p));
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      cache.addAll(["/", "/favicon.svg"]).catch(() => {
        // أول تشغيل بلا إنترنت أو مسار غير متاح مؤقتًا — لا يوقف التثبيت.
      }),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const shell = await cache.match("/");
    if (shell) return shell;
    return Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return cached || (await networkPromise) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (shouldBypass(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (["script", "style", "image", "font", "worker"].includes(request.destination)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
