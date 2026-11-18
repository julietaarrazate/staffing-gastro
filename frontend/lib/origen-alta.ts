/**
 * De qué enlace llegó la persona (fase 0 del plan de crecimiento, aprobado
 * por Julieta el 2026-11-18). El enlace con el que alguien entra puede traer
 * `?ref=` (los que arma Julieta: un grupo de WhatsApp, la bio de Instagram,
 * un volante) o `utm_source` / `utm_campaign` (los que agregan solos
 * Instagram, Linktree o un anuncio). `CapturaOrigen` los guarda al entrar y
 * el alta (`register` y `loginWithGoogle` en `lib/auth-context.tsx`) los
 * manda; el backend arma la etiqueta que se guarda con la cuenta
 * (`backend/app/modules/identity/domain/origen_alta.py`) y, sin nada, queda
 * «directo».
 *
 * `localStorage` y no `sessionStorage`: mucha gente ve el enlace en el
 * celular y se da de alta otro día. Vale 30 días; gana el último enlace con
 * origen (un enlace sin parámetros no borra el anterior) y se borra apenas se
 * crea la cuenta. Cada acceso va con try/catch: en modo privado o con el
 * almacenamiento bloqueado puede tirar, y sin él el alta sigue igual (queda
 * «directo»).
 */

export interface OrigenAlta {
  ref?: string;
  utm_source?: string;
  utm_campaign?: string;
}

const CLAVE = "oido_origen_alta";
export const VIGENCIA_MS = 30 * 24 * 60 * 60 * 1000;
// El backend recorta a 40 por parte; acá sólo se evita guardar textos enormes.
const LARGO_MAXIMO = 200;
const PARAMETROS = ["ref", "utm_source", "utm_campaign"] as const;

/** Los parámetros de origen de una URL (`location.search`), o `null` si no trae ninguno. */
export function origenDeUrl(search: string): OrigenAlta | null {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return null;
  }
  const origen: OrigenAlta = {};
  for (const clave of PARAMETROS) {
    const valor = params.get(clave)?.trim();
    if (valor) origen[clave] = valor.slice(0, LARGO_MAXIMO);
  }
  return Object.keys(origen).length > 0 ? origen : null;
}

/** Guarda el origen de la URL de entrada, si trae uno. */
export function capturarOrigen(search: string, ahora: number = Date.now()): void {
  const origen = origenDeUrl(search);
  if (!origen) return;
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify({ ...origen, guardado: ahora }));
  } catch {
    // Sin almacenamiento: el alta queda «directo».
  }
}

/** El origen guardado si sigue vigente; si venció o está roto, se borra. */
export function origenGuardado(ahora: number = Date.now()): OrigenAlta | null {
  let crudo: string | null;
  try {
    crudo = window.localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
  if (!crudo) return null;
  try {
    const leido = JSON.parse(crudo) as Record<string, unknown>;
    const guardado = typeof leido.guardado === "number" ? leido.guardado : NaN;
    if (!(ahora - guardado >= 0 && ahora - guardado <= VIGENCIA_MS)) {
      borrarOrigen();
      return null;
    }
    const origen: OrigenAlta = {};
    for (const clave of PARAMETROS) {
      const valor = leido[clave];
      if (typeof valor === "string" && valor) origen[clave] = valor.slice(0, LARGO_MAXIMO);
    }
    return Object.keys(origen).length > 0 ? origen : null;
  } catch {
    borrarOrigen();
    return null;
  }
}

/** Ya se creó la cuenta: el origen no vuelve a viajar. */
export function borrarOrigen(): void {
  try {
    window.localStorage.removeItem(CLAVE);
  } catch {
    // No hay nada que borrar.
  }
}
