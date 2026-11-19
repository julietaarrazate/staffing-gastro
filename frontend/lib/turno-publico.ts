import { cache } from "react";
import { api, ApiError } from "@/lib/api";
import type { ShiftPublic } from "@/lib/types";

/**
 * Lo que la página pública de un turno (`/turno/[id]`) sabe de él, según lo
 * que contesta `GET /shifts/{id}/public`:
 *
 * - `abierto` (200): se puede postular; trae la vista pública.
 * - `no_disponible` (410): fue público y ya no está abierto (se tomó, se
 *   canceló, quedó sin cubrir o pasó la hora). La API no manda ningún dato
 *   del turno, y la pantalla tampoco muestra ninguno.
 * - `no_encontrado` (404): no existe o nunca fue público (un borrador).
 */
export type TurnoPublico =
  | { estado: "abierto"; shift: ShiftPublic }
  | { estado: "no_disponible" }
  | { estado: "no_encontrado" };

// Un id que no es UUID no puede ser un turno: el backend responde 422 y la
// página daba 500 en vez de "no encontrado" (auditoría 2026-10-14).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function leerTurnoPublico(id: string): Promise<TurnoPublico> {
  if (!UUID_RE.test(id)) return { estado: "no_encontrado" };
  try {
    return { estado: "abierto", shift: await api.get<ShiftPublic>(`/shifts/${id}/public`) };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 410) return { estado: "no_disponible" };
      if (err.status === 404 || err.status === 422) return { estado: "no_encontrado" };
    }
    // Cualquier otra cosa (la API caída, un 5xx) es un error de verdad: no se
    // disfraza de «no existe».
    throw err;
  }
}

/** `cache`: el layout, `generateMetadata` y la página piden el mismo turno;
 *  así sale un solo pedido al backend por visita. */
export const getTurnoPublico = cache(leerTurnoPublico);
