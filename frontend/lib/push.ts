// Notificaciones push (Web Push / VAPID). Ver docs/reference/ACCESO_MODERNO.md.
//
// El service worker (`public/sw.js`) se registra recién acá, la primera vez
// que hace falta (opt-in del usuario o toggle en /profile) — no en el layout
// raíz: si el browser no soporta push, o el usuario nunca interactúa con la
// función, no tiene sentido registrar nada.

import { api, ApiError, backgroundApi, isTransientFailure } from "@/lib/api";

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
// `AuthProvider` llama a estas al abrir y al terminar la sesión; ninguna
// lanza, pide permiso ni toca la suscripción del navegador. Van por
// `backgroundApi`: son pedidos que nadie hizo desde una pantalla, así que un
// rechazo del candado de dos pasos de la admin no la lleva a ningún lado.

/** Cuánto espera el registro a una baja que no termina de contestar. */
export const CLAIM_WAITS_FOR_RELEASE_MS = 10_000;

/** Cuánto se espera la respuesta de una baja antes de darla por fallida (y
 * dejarla pendiente). Más que el tope del registro, a propósito: lo que
 * ordena el registro detrás de la baja es `CLAIM_WAITS_FOR_RELEASE_MS`. */
export const RELEASE_TIMEOUT_MS = 20_000;

/** Bajas que todavía no llegaron al servidor: los ids de las cuentas que
 * salieron de este navegador (no son un secreto). El `endpoint` y la clave
 * NO se guardan: se leen del navegador en cada intento. Vive en
 * `localStorage`, así que la comparten todas las pestañas y sobrevive a
 * cerrar la app. */
export const PENDING_RELEASES_KEY = "staffya_push_release_pending";
/** En un dispositivo compartido salen pocas cuentas seguidas sin conexión. */
const MAX_PENDING_RELEASES = 5;

function readPendingReleases(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(PENDING_RELEASES_KEY) ?? "[]");
    if (!Array.isArray(stored)) return [];
    return stored.filter((id): id is string => typeof id === "string" && id !== "");
  } catch {
    return [];
  }
}

function writePendingReleases(accountIds: string[]) {
  try {
    if (accountIds.length === 0) localStorage.removeItem(PENDING_RELEASES_KEY);
    else {
      localStorage.setItem(
        PENDING_RELEASES_KEY,
        JSON.stringify(accountIds.slice(-MAX_PENDING_RELEASES))
      );
    }
  } catch {
    // Sin `localStorage` no hay pendiente: queda el intento que ya salió.
  }
}

function addPendingRelease(accountId: string) {
  writePendingReleases([...readPendingReleases().filter((id) => id !== accountId), accountId]);
}

function dropPendingRelease(accountId: string) {
  const pending = readPendingReleases();
  if (pending.includes(accountId)) {
    writePendingReleases(pending.filter((id) => id !== accountId));
  }
}

// La última baja que salió de este navegador, primera vez o reintento (nunca
// rechaza). El cierre de sesión no la espera, así que puede seguir en camino
// cuando alguien vuelve a entrar. Si el registro nuevo llegara antes al
// servidor, la baja de la misma cuenta borraría la fila recién creada:
// Ajustes diría "Activadas" y no llegaría ningún aviso hasta volver a cargar
// la app.
let lastRelease: Promise<unknown> = Promise.resolve();
// Cuántas sesiones terminaron en esta pestaña (los reintentos no cuentan).
let sessionsEnded = 0;
// Cuántas bajas de cada cuenta están en camino desde esta pestaña.
const releasesInFlight = new Map<string, number>();

/** Al abrir la sesión (ingreso o sesión recuperada): si este navegador ya
 * tiene una suscripción y el permiso sigue concedido, la deja a nombre de la
 * cuenta de `token` (`POST /push/subscribe`, que reasigna el endpoint). Así
 * quien cerró sesión y vuelve a entrar en su celular no pierde los avisos, y
 * el interruptor del perfil (que mira el navegador) dice la verdad.
 *
 * `accountId` es la cuenta que entra. Si tenía una baja pendiente, se
 * descarta: volvió a entrar, y el registro la deja bien. Las pendientes de
 * otras cuentas se reintentan; no importa si llegan antes o después del
 * registro, porque el servidor sólo borra si la fila sigue siendo de la
 * cuenta que salió.
 *
 * Sale después de la baja de la sesión anterior, si sigue en camino, para que
 * lleguen al servidor en el orden en que pasaron. La espera tiene tope: una
 * baja colgada no puede dejar el dispositivo a nombre de la cuenta que salió
 * mientras otra ya está adentro. Y si mientras esperaba se cerró esta sesión
 * (salió otra baja), ya no se manda: llegaría después de su propia baja. */
export async function claimPushForAccount(token: string, accountId: string): Promise<boolean> {
  // Se mira antes de cualquier espera: una sesión que termina después es ésta.
  const endedBefore = sessionsEnded;
  try {
    dropPendingRelease(accountId);
    void retryPendingPushReleases(accountId);
    const releaseBefore = lastRelease;
    if (!isPushSupported() || Notification.permission !== "granted") return false;
    const subscription = await getCurrentPushSubscription();
    if (!subscription) return false;
    await settledWithin(releaseBefore, CLAIM_WAITS_FOR_RELEASE_MS);
    if (sessionsEnded !== endedBefore) return false;
    await backgroundApi.post("/push/subscribe", subscription.toJSON(), token);
    return true;
  } catch {
    return false;
  }
}

/** Cuando la sesión termina en este dispositivo (cierre de sesión, o la
 * sesión que venció, se suspendió o se revocó): lo da de baja en el servidor
 * para la cuenta `accountId`, así deja de recibir sus avisos, y saca de la
 * bandeja los que ya había mostrado. La suscripción del navegador queda,
 * para `claimPushForAccount` en el próximo ingreso.
 *
 * No usa el token de la sesión (pudo haber vencido): la prueba es la clave
 * de la suscripción (`POST /push/release`). La baja queda anotada como
 * pendiente ANTES de salir y se borra cuando el servidor la confirma: si no
 * hay red, el servidor no contesta o se cierra la app con el pedido en
 * camino, `retryPendingPushReleases` la vuelve a mandar. */
export function releasePushFromAccount(accountId: string): Promise<boolean> {
  void closeShownNotifications();
  sessionsEnded += 1;
  addPendingRelease(accountId);
  const release = sendRelease(accountId);
  lastRelease = release;
  return release;
}

/** Reintenta las bajas pendientes (al abrir la app, al volver la conexión y
 * al volver la pestaña al frente). `sessionOwnerId` es la cuenta que tiene la
 * sesión abierta en este navegador, si hay: la suya no se manda (ese
 * dispositivo es suyo). Tampoco las que esta pestaña ya tiene en camino.
 * Devuelve si todas las que mandó quedaron confirmadas. Nunca lanza. */
export function retryPendingPushReleases(sessionOwnerId: string | null = null): Promise<boolean> {
  const due = readPendingReleases().filter(
    (accountId) => accountId !== sessionOwnerId && !releasesInFlight.has(accountId)
  );
  if (due.length === 0) return Promise.resolve(true);
  const earlier = lastRelease;
  const attempt = Promise.all(due.map(sendRelease)).then((sent) => sent.every(Boolean));
  // El registro que venga espera a todo lo que esté en camino.
  lastRelease = Promise.all([earlier, attempt]);
  return attempt;
}

async function sendRelease(accountId: string): Promise<boolean> {
  releasesInFlight.set(accountId, (releasesInFlight.get(accountId) ?? 0) + 1);
  /** Ya no hay nada que reintentar. Si hay otra baja de la misma cuenta en
   * camino (entró y salió de nuevo), la pendiente es de ésa. */
  const settled = () => {
    if (releasesInFlight.get(accountId) === 1) dropPendingRelease(accountId);
  };
  try {
    const subscription = await getCurrentPushSubscription();
    const auth = subscription?.toJSON().keys?.auth;
    if (!subscription || !auth) {
      // El navegador ya no tiene suscripción: no hay dispositivo que dar de baja.
      settled();
      return false;
    }
    await backgroundApi.post(
      "/push/release",
      { endpoint: subscription.endpoint, auth, user_id: accountId },
      null,
      RELEASE_TIMEOUT_MS
    );
    settled();
    return true;
  } catch (err) {
    // Sin red, sin respuesta a tiempo, 429 o 5xx: queda pendiente. Un rechazo
    // definitivo del servidor no mejora reintentando. 404 y 405 tampoco son
    // definitivos acá: es lo que contesta un backend que todavía no tiene
    // `/push/release` (el frontend puede publicarse antes que el backend).
    if (err instanceof ApiError && !isTransientFailure(err) && !isRouteMissing(err)) settled();
    return false;
  } finally {
    const inFlight = (releasesInFlight.get(accountId) ?? 1) - 1;
    if (inFlight > 0) releasesInFlight.set(accountId, inFlight);
    else releasesInFlight.delete(accountId);
  }
}

function isRouteMissing(err: ApiError): boolean {
  return err.status === 404 || err.status === 405;
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
