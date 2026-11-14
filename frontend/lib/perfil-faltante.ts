import { api, ApiError } from "@/lib/api";
import { bienvenidaHref } from "@/lib/safe-next";
import type { User, UserRole } from "@/lib/types";

/**
 * La cuenta existe pero su perfil no: la persona cerró la app (o recargó, o
 * volvió atrás) en medio de `/bienvenida` (U034, U035).
 *
 * Lo que responde el backend en ese caso, y de lo que depende esto:
 * - `GET /workers/me/profile` → 404 «Todavía no creaste tu perfil de trabajador»
 * - `GET /companies/me/profile` → 404 «Todavía no creaste tu perfil de comercio»
 * - `GET /shifts/me` (panel del comercio) → 400 «Primero creá tu perfil de
 *   comercio para publicar turnos»
 * El admin no tiene perfil: nunca se le pide.
 */

const RUTA_PERFIL: Partial<Record<UserRole, string>> = {
  worker: "/workers/me/profile",
  employer: "/companies/me/profile",
};

/** Sólo el 404 del propio perfil cuenta como «falta». Un error de red o un
 * 500 no: no se manda a nadie a la bienvenida por una falla pasajera. */
export function esPerfilInexistente(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}

/** El panel del comercio sin perfil responde 400 con este texto fijo. */
export function esComercioSinPerfil(err: unknown): boolean {
  return err instanceof ApiError && err.status === 400 && /perfil de comercio/i.test(err.message);
}

/** `true` si la cuenta es de un rol con perfil y todavía no lo creó. */
export async function faltaPerfil(token: string, role: UserRole): Promise<boolean> {
  const ruta = RUTA_PERFIL[role];
  if (!ruta) return false;
  try {
    await api.get(ruta, token);
    return false;
  } catch (err) {
    return esPerfilInexistente(err);
  }
}

/** A dónde sigue el ingreso: a la bienvenida (que después vuelve a `next`) si
 * falta el perfil de su rol, y si no al destino de siempre. */
export async function destinoTrasIngreso(
  sesion: { token?: string; user?: User } | undefined,
  next: string | null,
  porDefecto = "/"
): Promise<string> {
  const destino = next ?? porDefecto;
  if (!sesion?.token || !sesion.user) return destino;
  return (await faltaPerfil(sesion.token, sesion.user.role)) ? bienvenidaHref(next) : destino;
}
