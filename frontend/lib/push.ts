// Notificaciones push (Web Push / VAPID). Ver docs/reference/ACCESO_MODERNO.md.
//
// El service worker (`public/sw.js`) se registra recién acá, la primera vez
// que hace falta (opt-in del usuario o toggle en /profile) — no en el layout
// raíz: si el browser no soporta push, o el usuario nunca interactúa con la
// función, no tiene sentido registrar nada.

import { api } from "@/lib/api";

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
