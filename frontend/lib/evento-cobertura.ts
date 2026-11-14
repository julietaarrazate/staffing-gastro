import type { ShiftStatus } from "./types";

// Cuándo un puesto del evento cuenta como «cubierto»: la persona ya confirmó
// (o va más adelante en el ciclo). Una asignada que todavía no confirmó puede
// rechazar y el puesto vuelve a buscar, así que no cuenta.
const CUBIERTOS: ReadonlySet<ShiftStatus> = new Set<ShiftStatus>([
  "confirmado",
  "en_camino",
  "check_in",
  "trabajando",
  "check_out",
  "finalizado",
  "pagado",
]);

export type EventoCobertura = { name: string; total: number; covered: number };

type PuestoDeEvento = {
  event_id?: string | null;
  event_name?: string | null;
  status: ShiftStatus;
};

/**
 * «N/M cubiertos» por evento. Un puesto cancelado ya no se necesita: no entra
 * en M ni en N, así el contador baja al cancelar. Un evento con todos sus
 * puestos cancelados no aparece.
 */
export function coberturaPorEvento(
  shifts: readonly PuestoDeEvento[]
): Array<EventoCobertura & { eventId: string }> {
  const byId = new Map<string, EventoCobertura>();
  for (const shift of shifts) {
    if (!shift.event_id || shift.status === "cancelado") continue;
    const entry = byId.get(shift.event_id) ?? {
      name: shift.event_name ?? "Evento",
      total: 0,
      covered: 0,
    };
    entry.total += 1;
    if (CUBIERTOS.has(shift.status)) entry.covered += 1;
    byId.set(shift.event_id, entry);
  }
  return Array.from(byId.entries()).map(([eventId, data]) => ({ eventId, ...data }));
}
