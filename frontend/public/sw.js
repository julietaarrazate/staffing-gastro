// Service worker mínimo, sólo para Web Push (ver docs/ACCESO_MODERNO.md).
// El repo NO tenía service worker antes de esto: no se agrega ningún tipo de
// caching/offline (eso sería un cambio de alcance mucho mayor, con sus
// propios riesgos de servir assets viejos post-deploy) — sólo lo
// imprescindible para recibir y mostrar notificaciones push.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || "Staffya";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/" },
      tag: "staffya-push",
      renotify: true,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data && event.notification.data.url ? event.notification.data.url : "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientsList) => {
      for (const c of clientsList) {
        if (c.url.includes(self.location.origin) && "focus" in c) {
          c.navigate(targetUrl);
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
