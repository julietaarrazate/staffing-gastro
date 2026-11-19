/**
 * Cloudflare Turnstile (anti-robots) en login y registro.
 *
 * El widget (`components/TurnstileWidget.tsx`) deja acá el token que le da
 * Cloudflare, y `lib/api.ts` lo manda en `X-Turnstile-Token` sólo a
 * `/auth/login` y `/auth/register`. El backend lo valida contra Cloudflare
 * (`backend/app/core/turnstile.py`): el navegador no decide nada.
 *
 * Sin `NEXT_PUBLIC_TURNSTILE_SITE_KEY` no hay widget ni header (local, tests
 * E2E y hasta que se configure en Cloudflare).
 */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

const PROTECTED_PATHS = new Set(["/auth/login", "/auth/register"]);
let currentToken: string | null = null;

export function setTurnstileToken(token: string | null) {
  currentToken = token;
}

export function turnstileHeaders(path: string): Record<string, string> {
  return currentToken && PROTECTED_PATHS.has(path)
    ? { "X-Turnstile-Token": currentToken }
    : {};
}

export type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";
export const TURNSTILE_SCRIPT_SRC = `${TURNSTILE_ORIGIN}/turnstile/v0/api.js?render=explicit`;
let scriptPromise: Promise<TurnstileApi> | null = null;

/** Baja el script de Turnstile una sola vez (lo comparten la precarga y el widget). */
export function cargarTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    // Si falla (o carga sin dejar `window.turnstile`), se olvida: el próximo
    // intento (el widget al montarse) baja el script de nuevo.
    const fallar = () => {
      script.remove();
      scriptPromise = null;
      reject(new Error("turnstile"));
    };
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : fallar());
    script.onerror = fallar;
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Adelanta la descarga del script para que el tilde salga antes al entrar o
 * registrarse (medido el 2026-11-19: el botón «Ingresar» espera el token, y
 * el script empezaba a bajar recién con el formulario a la vista; ver
 * docs/reference/RENDIMIENTO.md). Sólo baja `api.js`: sin `render` no corre
 * ninguna verificación ni deja cookies. Sin clave, no hace nada.
 */
export function precargarTurnstile() {
  if (!TURNSTILE_SITE_KEY || typeof window === "undefined") return;
  cargarTurnstile().catch(() => {
    // El widget lo vuelve a intentar al montarse.
  });
}
