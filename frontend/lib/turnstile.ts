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
