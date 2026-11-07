/* ComproNext service worker
 * - ไฟล์ static (JS/CSS/ฟอนต์/รูปห้อง/ไอคอน) เก็บแคชไว้ เปิดซ้ำเร็วขึ้น
 * - หน้าเว็บโหลดสดทุกครั้ง แล้วเก็บสำเนาหน้าสาธารณะที่เคยเปิด (สินค้า ห้อง ร้าน หมวด) ไว้ 40 หน้า
 *   → ไม่มีเน็ตก็เปิดหน้าที่เคยดูได้ ถ้าไม่เคยเปิดจะแสดงหน้า /offline
 * - หน้าส่วนตัว (บัญชี ตะกร้า ข้อความ แอดมิน) ไม่เก็บ
 * - รับแจ้งเตือน (ข้อความจากร้าน / ของที่ติดตามลดราคา)
 */
const VERSION = "v2";
const STATIC_CACHE = `cn-static-${VERSION}`;
const PAGE_CACHE = `cn-pages-${VERSION}`;
const OFFLINE_URL = "/offline";
const MAX_PAGES = 40;
const PRIVATE = /^\/(account|admin|cart|messages|partner|login|saved|api|d\/)/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((c) => c.addAll([OFFLINE_URL, "/icons/icon-192.png"]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("cn-") && k !== STATIC_CACHE && k !== PAGE_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isStatic(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/rooms/") && /\.(png|jpe?g|webp|svg)$/i.test(url.pathname) ||
    url.pathname.startsWith("/icons/") ||
    /^\/(products|furniture|lighting)\//.test(url.pathname) && /\.(png|jpe?g|webp|svg)$/i.test(url.pathname)
  );
}

async function trimPages() {
  const cache = await caches.open(PAGE_CACHE);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_PAGES; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !PRIVATE.test(url.pathname) && !res.headers.get("cache-control")?.includes("no-store")) {
            const copy = res.clone();
            event.waitUntil(caches.open(PAGE_CACHE).then((c) => c.delete(req).then(() => c.put(req, copy))).then(trimPages));
          }
          return res;
        })
        .catch(async () => (await caches.match(req, { cacheName: PAGE_CACHE })) || caches.match(OFFLINE_URL))
    );
    return;
  }

  if (isStatic(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })
    );
  }
});

/* ---------- แจ้งเตือน ---------- */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "ComproNext", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "ComproNext", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.url) || "/";
  const target = new URL(path, self.location.origin);
  if (target.origin !== self.location.origin) return;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(target.href);
          return c.focus();
        }
      }
      return self.clients.openWindow(target.href);
    })
  );
});
