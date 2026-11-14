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
 * - una `//` en cualquier parte de la ruta (antes del `?` o el `#`): ninguna
 *   pantalla de la app la tiene, y al resolver los `.` y `..` de adelante
 *   (`/.//otro.sitio`, `/a/..//otro.sitio`, `/%2e//otro.sitio`) queda al
 *   inicio y vuelve a ser otro sitio;
 * - volver al propio ingreso o alta (`/login`, `/register`) o al primer
 *   arranque (`/bienvenida`), que no llevan a ningún lado (o dan vueltas).
 *
 * Lo que se devuelve es la ruta ya resuelta, y se valida **eso**, no sólo lo
 * que entró: resolverla de nuevo tiene que dar el mismo sitio y la misma ruta.
 */
const BASE = "https://oido.invalid";
const MAX_LENGTH = 512;
const SIN_VUELTA = ["/login", "/register", "/bienvenida"];

export function safeNext(value: string | null | undefined): string | null {
  if (!value || value.length > MAX_LENGTH) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\")) return null;
  if (value.split(/[?#]/, 1)[0].includes("//")) return null;
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return null;
  }
  // Red de seguridad: si después de resolver ya no es este sitio, afuera.
  if (url.origin !== BASE) return null;
  if (SIN_VUELTA.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`))) return null;
  const resolved = `${url.pathname}${url.search}${url.hash}`;
  // Lo que sale tiene que ser tan interno como lo que entró: si al resolverlo
  // otra vez cambia de sitio o de ruta, no se usa.
  if (!resolved.startsWith("/") || resolved.startsWith("//") || resolved.includes("\\")) return null;
  try {
    const again = new URL(resolved, BASE);
    if (again.origin !== BASE || again.pathname !== url.pathname) return null;
  } catch {
    return null;
  }
  return resolved;
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

/** Avisos que otra pantalla le deja al ingreso (`/login?aviso=…`). Igual que
 * el motivo: viaja una palabra y el texto lo pone la app. Antes viajaba el
 * texto entero (`?message=…`) y el ingreso mostraba lo que viniera en la
 * dirección, así que un link armado por otro le hacía decir cualquier cosa. */
export type LoginNotice = "clave-actualizada" | "codigo-requerido";

export const LOGIN_NOTICES: Record<LoginNotice, string> = {
  "clave-actualizada": "Contraseña actualizada. Ingresá con tu nueva contraseña.",
  "codigo-requerido": "Volvé a ingresar con el código de tu app autenticadora.",
};

export function isLoginNotice(value: string | null | undefined): value is LoginNotice {
  return value === "clave-actualizada" || value === "codigo-requerido";
}

/** La dirección del ingreso con el motivo y la vuelta. `next` se valida acá
 * también: lo arma la app con la ruta en la que estaba, pero esa ruta puede
 * traer cualquier cosa en su query. */
export function loginHref(
  opts: { motivo?: SessionEndReason | null; aviso?: LoginNotice | null; next?: string | null } = {}
): string {
  const params = new URLSearchParams();
  if (opts.motivo) params.set("motivo", opts.motivo);
  if (opts.aviso) params.set("aviso", opts.aviso);
  const next = safeNext(opts.next);
  if (next && next !== "/") params.set("next", next);
  const query = params.toString();
  return query ? `/login?${query}` : "/login";
}

/** Qué pantallas pueden ser el destino del ingreso que se abre desde la
 * cabecera. Un solo lugar: hoy sólo el turno público compartido (`/turno/…`).
 * El resto (recuperar, términos, «no encontrada»…) no vuelve: tras ingresar la
 * persona va a su inicio. Devuelve la ruta (ya validada) o `null`. */
export function nextDeCabecera(pathname: string, search = ""): string | null {
  if (!pathname.startsWith("/turno/")) return null;
  return safeNext(search ? `${pathname}?${search}` : pathname);
}

/** Agrega `next` (validado, y no la raíz) a una dirección. */
function withNext(path: string, params: URLSearchParams, next: string | null | undefined): string {
  const safe = safeNext(next);
  if (safe && safe !== "/") params.set("next", safe);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/** La dirección del alta, con el rol preseleccionado y la vuelta. */
export function registerHref(opts: { rol?: "trabajador" | "comercio" | null; next?: string | null } = {}): string {
  const params = new URLSearchParams();
  if (opts.rol) params.set("rol", opts.rol);
  return withNext("/register", params, opts.next);
}

/** La dirección del primer arranque, que al terminar vuelve a `next`. */
export function bienvenidaHref(next?: string | null): string {
  return withNext("/bienvenida", new URLSearchParams(), next);
}
