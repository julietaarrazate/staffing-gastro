// Lógica pura de la recarga por versión nueva (la usa
// `components/ActualizadorVersion.tsx`; separada para poder testearla).

export const CLAVE_RECARGADO = "oido:recargado-por-version";

/** Versión del bundle que está corriendo (inlineada en el build). */
export const VERSION_LOCAL: string = process.env.NEXT_PUBLIC_BUILD_ID ?? "";

/** Decide si hay que recargar: la servida es distinta de la del bundle, ambas
 * existen, y no se recargó ya por esa misma versión (anti-loop: si tras
 * recargar el bundle siguiera viejo, por una caché, no se insiste). */
export function debeRecargar(opts: {
  local: string;
  remota: string | null;
  yaRecargadoPor: string | null;
}): boolean {
  const { local, remota, yaRecargadoPor } = opts;
  if (!local || !remota) return false;
  if (local === remota) return false;
  return yaRecargadoPor !== remota;
}

export function leerRecargadoPor(): string | null {
  try {
    return sessionStorage.getItem(CLAVE_RECARGADO);
  } catch {
    return null;
  }
}

/** Devuelve `false` si no se pudo guardar: sin la marca no hay anti-loop,
 * así que quien llama NO debe recargar. */
export function marcarRecargadoPor(version: string): boolean {
  try {
    sessionStorage.setItem(CLAVE_RECARGADO, version);
    return sessionStorage.getItem(CLAVE_RECARGADO) === version;
  } catch {
    return false;
  }
}

/** Pide la versión servida, sin caché. `null` si no se pudo (offline, etc.). */
export async function pedirVersionRemota(): Promise<string | null> {
  try {
    const r = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return null;
    const d = (await r.json()) as { version?: unknown };
    return typeof d.version === "string" && d.version ? d.version : null;
  } catch {
    return null;
  }
}
