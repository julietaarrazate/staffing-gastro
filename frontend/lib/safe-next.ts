/**
 * `next`: a dónde volver después de ingresar (`/login?next=…`). Viene de la
 * dirección, así que cualquiera puede armar un link con lo que quiera: sólo
 * se acepta una **ruta interna** de la app. Todo lo demás devuelve `null` y
 * el ingreso sigue a la home del rol.
 *
 * Qué se rechaza y por qué:
 * - lo que no empieza con una sola `/`: `https://otro.sitio`, `javascript:…`,
 *   y `//otro.sitio`, que para el navegador es otro sitio con el mismo
 *   protocolo;
 * - cualquier `\`: los navegadores la leen como `/`, así que `/\otro.sitio`
 *   también sale de la app;
 * - caracteres de control (tabulación, salto de línea): el navegador los
 *   saca antes de resolver, y `/\t/otro.sitio` termina en `//otro.sitio`;
 * - volver al propio ingreso (`/login`), que no lleva a ningún lado.
 */
const BASE = "https://oido.invalid";
const MAX_LENGTH = 512;

export function safeNext(value: string | null | undefined): string | null {
  if (!value || value.length > MAX_LENGTH) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\")) return null;
  // eslint-disable-next-line no-control-regex -- justamente se buscan los caracteres de control
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return null;
  }
  // Red de seguridad: si después de resolver ya no es este sitio, afuera.
  if (url.origin !== BASE) return null;
  if (url.pathname === "/login" || url.pathname.startsWith("/login/")) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Por qué se cerró una sesión sin que la persona lo pidiera. */
export type SessionEndReason = "vencida" | "suspendida";

/** Lo que dice el ingreso según el motivo. Sólo estos dos textos: lo que
 * venga en `?motivo=` y no esté acá no se muestra. */
export const SESSION_END_MESSAGES: Record<SessionEndReason, string> = {
  vencida: "Tu sesión venció, volvé a ingresar.",
  suspendida:
    "Tu cuenta está suspendida. Si creés que es un error, escribinos a hola@oido.com.ar.",
};

export function isSessionEndReason(value: string | null | undefined): value is SessionEndReason {
  return value === "vencida" || value === "suspendida";
}

/** La dirección del ingreso con el motivo y la vuelta. `next` se valida acá
 * también: lo arma la app con la ruta en la que estaba, pero esa ruta puede
 * traer cualquier cosa en su query. */
export function loginHref(opts: { motivo?: SessionEndReason | null; next?: string | null } = {}): string {
  const params = new URLSearchParams();
  if (opts.motivo) params.set("motivo", opts.motivo);
  const next = safeNext(opts.next);
  if (next && next !== "/") params.set("next", next);
  const query = params.toString();
  return query ? `/login?${query}` : "/login";
}
