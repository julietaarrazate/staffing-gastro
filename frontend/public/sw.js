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
  const title = data.title || "Oído";
  const url = data.url || "/";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icon-192.png",
      // El badge (ícono chico de la barra de estado en Android) se dibuja
      // usando SÓLO el canal alfa: el sistema descarta los colores y pinta de
      // blanco lo que sea opaco. `icon-192.png` es un tile naranja opaco de
      // punta a punta, así que salía como un CUADRADO BLANCO sólido. Este
      // badge tiene fondo transparente y sólo la cloche opaca.
      badge: "/badge-96.png",
      data: { url },
      // Tag ÚNICO por notificación. Antes todas compartían "staffya-push", así
      // que cada aviso nuevo REEMPLAZABA al anterior: si llegaban tres (un
      // postulante, un mensaje, una reseña) el trabajador sólo veía el último.
      // Con un tag distinto se apilan como en cualquier app.
      tag: data.tag || `staffya-${Date.now()}`,
      // Vibración corta: la señal física que hace que un aviso de turno
      // urgente se note con el teléfono en el bolsillo.
      vibrate: [80, 40, 80],
      // Botón de acción directo, para resolver desde la notificación sin
      // tener que buscar la pantalla.
      actions: [{ action: "open", title: "Ver" }],
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
