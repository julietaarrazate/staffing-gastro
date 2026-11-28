import { api, ApiError } from "@/lib/api";
import type { ApplicationStatus, Shift, ShiftApplication } from "@/lib/types";

/**
 * Estados en los que el trabajador ya está en la lista del comercio y no
 * puede postularse otra vez: espera la respuesta (`pendiente`), ya lo
 * eligieron (`aceptada`), o tuvo el turno asignado y lo dejó (`desasignada`:
 * sigue en la lista, al final, y es el comercio quien decide si lo vuelve a
 * elegir; el backend responde 409 si intenta postularse).
 *
 * Una `retirada` (la canceló él, o la app al confirmar otro turno del mismo
 * horario) ya no cuenta: mientras el turno siga abierto puede volver a
 * postularse, y el backend reactiva esa misma postulación. Una `rechazada`
 * tampoco es estar postulado.
 */
const ACTIVE_STATUSES: readonly ApplicationStatus[] = ["pendiente", "aceptada", "desasignada"];

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

/**
 * Ids de los turnos que el trabajador tuvo asignados y dejó (rechazó, canceló
 * o no se presentó). El detalle del turno no dice «Ya te postulaste» sino
 * «Ya tuviste este turno asignado»: puede que nunca se haya postulado (lo
 * asignaron directo) y no hay una respuesta del comercio que esperar.
 */
export function unassignedShiftIds(
  applications: readonly Pick<ShiftApplication, "shift_id" | "status">[]
): Set<string> {
  return new Set(applications.filter((a) => a.status === "desasignada").map((a) => a.shift_id));
}

/** Código que manda el servidor cuando el turno ya empieza en menos de 6 horas
 *  y la persona no reconoció «Puedo ir ya» (pantalla cargada antes). */
export const PUEDO_IR_YA_REQUERIDO = "puedo_ir_ya_requerido";

export function esPuedoIrYaRequerido(err: unknown): boolean {
  return err instanceof ApiError && err.status === 409 && err.code === PUEDO_IR_YA_REQUERIDO;
}

/**
 * `POST /applications/shifts/{id}`: la única forma de postularse (ADR-0032).
 *
 * Quien llama ya preguntó «¿Podés ir a este turno?» si `shift.apply_commits`;
 * en ese caso se manda `{ puedo_ir_ya: true }` y el servidor GUARDA ese
 * reconocimiento. Si la pantalla se cargó antes de que el turno entrara en las
 * 6 horas, el servidor responde 409 `puedo_ir_ya_requerido` sin crear nada:
 * se abre la pregunta (`confirmar`) y se reintenta con el reconocimiento.
 * Devuelve `null` si la persona dijo «Ahora no»; si no, si quedó ofrecida
 * para ya (lo que dice «Te ofreciste…»).
 */
export async function enviarPostulacion(opts: {
  token: string;
  shift: Pick<Shift, "id" | "start_at"> & { apply_commits?: boolean };
  key: string;
  confirmar: (shift: Pick<Shift, "start_at"> & { apply_commits?: boolean }) => Promise<boolean>;
}): Promise<{ ofrecido: boolean } | null> {
  const { token, shift, key, confirmar } = opts;
  let reconocido = Boolean(shift.apply_commits);
  for (;;) {
    try {
      await api.post(
        `/applications/shifts/${shift.id}`,
        reconocido ? { puedo_ir_ya: true } : undefined,
        token,
        undefined,
        key
      );
      return { ofrecido: reconocido };
    } catch (err) {
      if (reconocido || !esPuedoIrYaRequerido(err)) throw err;
      if (!(await confirmar({ ...shift, apply_commits: true }))) return null;
      reconocido = true;
    }
  }
}
