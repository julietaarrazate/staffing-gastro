import type { Shift, ShiftStatus } from "@/lib/types";

/**
 * Estados con el trabajador ya comprometido: confirmó o está en pleno turno.
 * Espeja `COMMITTED_STATUSES` del backend
 * (`backend/app/modules/shift/domain/value_objects.py`). Cancelar desde acá
 * es una cancelación tardía (ADR-0007): no hay plazo en horas, sólo el estado.
 */
const COMMITTED_STATUSES: readonly ShiftStatus[] = [
  "confirmado",
  "en_camino",
  "check_in",
  "trabajando",
  "check_out",
];

/** Estados en los que todavía puede haber gente postulada esperando respuesta. */
const OPEN_STATUSES: readonly ShiftStatus[] = ["publicado", "buscando_personal"];

type CancellableShift = Pick<Shift, "status" | "worker_profile_id">;

/**
 * ¿Cancelar este turno le suma una cancelación tardía al comercio? Misma
 * cuenta que `ShiftService.cancel_shift`: estado comprometido y alguien
 * asignado.
 */
export function isLateCancellation(shift: CancellableShift): boolean {
  return COMMITTED_STATUSES.includes(shift.status) && Boolean(shift.worker_profile_id);
}

export const LATE_CANCELLATION_WARNING =
  "Te suma una cancelación tardía. La ves en tu perfil.";

export interface CancelConfirmCopy {
  /** A quién se le avisa y que no se puede deshacer. */
  body: string;
  /** El costo para el comercio. `null` cuando cancelar no le cuesta nada. */
  lateCancellation: string | null;
}

/**
 * Texto de «¿Cancelar este turno?» según el estado: dice a quién se le avisa
 * (lo mismo que hace el backend) y, sólo si aplica, que suma una cancelación
 * tardía. Antes de confirmar, no después.
 */
export function cancelConfirmCopy(shift: CancellableShift | undefined): CancelConfirmCopy {
  if (shift && isLateCancellation(shift)) {
    return {
      body: "El trabajador ya confirmó: se le avisa que el turno se cancela y no vas a poder deshacerlo.",
      lateCancellation: LATE_CANCELLATION_WARNING,
    };
  }
  if (shift?.worker_profile_id) {
    return {
      body: "Ya tenés un trabajador asignado: se le avisa que el turno se cancela y no vas a poder deshacerlo.",
      lateCancellation: null,
    };
  }
  if (shift && OPEN_STATUSES.includes(shift.status)) {
    return {
      body: "El turno deja de estar disponible para postularse. Si alguien se postuló, se le avisa. No vas a poder deshacerlo.",
      lateCancellation: null,
    };
  }
  return {
    body: "El turno deja de estar disponible para postularse. No vas a poder deshacerlo.",
    lateCancellation: null,
  };
}
