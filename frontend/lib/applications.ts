import type { ApplicationStatus, ShiftApplication } from "@/lib/types";

/**
 * Estados en los que el trabajador sigue postulado a un turno: espera la
 * respuesta del comercio (`pendiente`) o ya lo eligieron (`aceptada`).
 *
 * Una `retirada` (la canceló él, o la app al confirmar otro turno del mismo
 * horario) ya no cuenta: mientras el turno siga abierto puede volver a
 * postularse, y el backend reactiva esa misma postulación. Una `rechazada`
 * tampoco es estar postulado.
 */
const ACTIVE_STATUSES: readonly ApplicationStatus[] = ["pendiente", "aceptada"];

/**
 * Ids de los turnos a los que el trabajador está postulado hoy, a partir de
 * `GET /applications/mine`.
 *
 * Es la única definición de "ya me postulé" del frontend: Inicio, Buscar y
 * el Mapa esconden estos turnos, y el detalle (`/turno/[id]`) muestra "Ya te
 * postulaste" en vez de "Postularme". Antes cada pantalla armaba su propia
 * cuenta con todas las postulaciones, sin mirar el estado, y un turno con la
 * postulación retirada desaparecía para siempre.
 */
export function appliedShiftIds(
  applications: readonly Pick<ShiftApplication, "shift_id" | "status">[]
): Set<string> {
  return new Set(
    applications.filter((a) => ACTIVE_STATUSES.includes(a.status)).map((a) => a.shift_id)
  );
}
