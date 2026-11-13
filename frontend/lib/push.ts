// Notificaciones push (Web Push / VAPID). Ver docs/reference/ACCESO_MODERNO.md.
//
// El service worker (`public/sw.js`) se registra recién acá, la primera vez
// que hace falta (opt-in del usuario o toggle en /profile) — no en el layout
// raíz: si el browser no soporta push, o el usuario nunca interactúa con la
// función, no tiene sentido registrar nada.

import { api, backgroundApi } from "@/lib/api";

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// El backend entrega la clave VAPID en base64url; `PushManager.subscribe`
// necesita un `Uint8Array` (formato "applicationServerKey").
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

/** Suscripción actual, si el service worker ya está registrado y el usuario
 * ya había activado las notificaciones antes (no registra nada nuevo). */
export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

/** Pide permiso al browser (si hace falta), registra el service worker y
 * suscribe este dispositivo. Devuelve `false` sin lanzar si algo no está
 * disponible (navegador sin soporte, permiso denegado, servidor sin VAPID
 * configurado) — nunca debe romper el flujo que la llama. */
export async function subscribeToPush(token: string): Promise<boolean> {
  if (!isPushSupported()) return false;

  const { vapid_public_key } = await api.get<{ vapid_public_key: string | null }>(
    "/push/public-key"
  );
  if (!vapid_public_key) return false;

  if (Notification.permission === "denied") return false;

  const registration = await getRegistration();
  if (!registration) return false;

  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid_public_key) as BufferSource,
    }));

  await api.post("/push/subscribe", subscription.toJSON(), token);
  return true;
}

export async function unsubscribeFromPush(token: string): Promise<void> {
  const subscription = await getCurrentPushSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await api.del("/push/subscribe", { endpoint }, token);
}

// --- El push es de la cuenta que tiene la sesión abierta -------------------
//
// La suscripción es del navegador, no de la persona: en un dispositivo
// compartido (o con dos cuentas) quedaba a nombre de quien la activó primero.
// `AuthProvider` llama a estas dos al abrir y al cerrar la sesión; ninguna
// lanza, pide permiso ni toca la suscripción del navegador. Van por
// `backgroundApi`: son pedidos que nadie hizo desde una pantalla, así que un
// rechazo del candado de dos pasos de la admin no la lleva a ningún lado.

/** Cuánto espera el registro a una baja que no termina de contestar. */
export const CLAIM_WAITS_FOR_RELEASE_MS = 10_000;

// La última baja que salió de este navegador (nunca rechaza). El cierre de
// sesión no la espera, así que puede seguir en camino cuando alguien vuelve a
// entrar. Si el registro nuevo llegara antes al servidor, la baja de la misma
// cuenta borraría la fila recién creada: Ajustes diría "Activadas" y no
// llegaría ningún aviso hasta volver a cargar la app.
let lastRelease: Promise<unknown> = Promise.resolve();

/** Al abrir la sesión (ingreso o sesión recuperada): si este navegador ya
 * tiene una suscripción y el permiso sigue concedido, la deja a nombre de la
 * cuenta de `token` (`POST /push/subscribe`, que reasigna el endpoint). Así
 * quien cerró sesión y vuelve a entrar en su celular no pierde los avisos, y
 * el interruptor del perfil (que mira el navegador) dice la verdad.
 *
 * Sale después de la baja de la sesión anterior, si sigue en camino, para que
 * lleguen al servidor en el orden en que pasaron. La espera tiene tope: una
 * baja colgada no puede dejar el dispositivo a nombre de la cuenta que salió
 * mientras otra ya está adentro. Y si mientras esperaba se cerró esta sesión
 * (salió otra baja), ya no se manda: llegaría después de su propia baja. */
export async function claimPushForAccount(token: string): Promise<boolean> {
  // Se mira antes de cualquier espera: una baja posterior es de esta sesión.
  const releaseBefore = lastRelease;
  try {
    if (!isPushSupported() || Notification.permission !== "granted") return false;
    const subscription = await getCurrentPushSubscription();
    if (!subscription) return false;
    await settledWithin(releaseBefore, CLAIM_WAITS_FOR_RELEASE_MS);
    if (lastRelease !== releaseBefore) return false;
    await backgroundApi.post("/push/subscribe", subscription.toJSON(), token);
    return true;
  } catch {
    return false;
  }
}

/** Al cerrar sesión: da de baja este dispositivo en el servidor para la
 * cuenta de `token`, así deja de recibir sus avisos, y saca de la bandeja
 * los que ya había mostrado. La suscripción del navegador queda, para
 * `claimPushForAccount` en el próximo ingreso. */
export function releasePushFromAccount(token: string): Promise<boolean> {
  void closeShownNotifications();
  const release = sendRelease(token);
  lastRelease = release;
  return release;
}

async function sendRelease(token: string): Promise<boolean> {
  try {
    const subscription = await getCurrentPushSubscription();
    if (!subscription) return false;
    await backgroundApi.del("/push/subscribe", { endpoint: subscription.endpoint }, token);
    return true;
  } catch {
    return false;
  }
}

/** Espera a que `promise` termine, bien o mal, pero no más de `ms`. */
function settledWithin(promise: Promise<unknown>, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    promise.then(done, done);
  });
}

/** Los avisos que ya se mostraron quedan en la bandeja del sistema con su
 * título y su texto: en un dispositivo compartido, quien lo usa después los
 * seguiría leyendo aunque no lleguen nuevos. Sólo ve los de este service
 * worker. No se espera y nunca lanza. */
async function closeShownNotifications(): Promise<void> {
  try {
    if (!isPushSupported()) return;
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    const shown = (await registration?.getNotifications()) ?? [];
    for (const notification of shown) notification.close();
  } catch {
    // Navegador que no deja leerlos: no hay nada más que hacer acá.
  }
}
