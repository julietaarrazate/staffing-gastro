"use client";

import { Modal } from "@/components/ui";
import { SKILL_LABELS, Shift } from "@/lib/types";
import { formatShiftRange, shiftDurationMinutes } from "@/lib/datetime";
import { distanceOf } from "@/lib/current-location";

/** Distancia legible: bajo 1 km en metros redondeados, arriba con un
 * decimal — mismo formato que `OpportunityCard.formatDistance`. */
function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function payPerHour(shift: Shift): number | null {
  const minutes = shiftDurationMinutes(shift.start_at, shift.end_at);
  if (minutes === null) return null;
  return (Number(shift.pay_amount) / minutes) * 60;
}

/**
 * Comparador de turnos guardados (evolución directa de "guardar turnos":
 * pedido original de Julieta era "empezar a evaluar opciones que
 * convengan" — una lista sola no compara, esto sí). Columnas lado a lado
 * con lo que de verdad decide si conviene: pago, pago por hora (no todos
 * los turnos duran lo mismo), cuándo, distancia y beneficios.
 */
export default function CompareShiftsModal({
  shifts,
  origin,
  open,
  onClose,
}: {
  shifts: Shift[];
  /** Origen para la distancia — perfil o "estoy acá ahora", igual que el feed. */
  origin: [number, number] | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Comparar turnos guardados">
      <div className="-mx-1 overflow-x-auto pb-1">
        <div className="flex gap-3 px-1">
          {shifts.map((shift) => {
            const perHour = payPerHour(shift);
            const distanceKm = distanceOf(shift, origin);
            return (
              <div
                key={shift.id}
                className="w-[168px] shrink-0 rounded-2xl bg-surface p-3 ring-1 ring-line"
              >
                <p className="line-clamp-1 text-sm font-bold text-ink">
                  {shift.company_name ?? "Local"}
                </p>
                <p className="text-xs text-ink/50">{SKILL_LABELS[shift.position]}</p>

                <div className="mt-3 space-y-2.5 text-xs">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ink/40">Pago</p>
                    <p className="text-base font-extrabold leading-tight text-primary-text">
                      {shift.currency} {Number(shift.pay_amount).toLocaleString("es-AR")}
                    </p>
                  </div>
                  {perHour !== null && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-ink/40">
                        Por hora
                      </p>
                      <p className="font-semibold text-ink">
                        {shift.currency} {Math.round(perHour).toLocaleString("es-AR")}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ink/40">Cuándo</p>
                    <p className="font-medium leading-snug text-ink/80">
                      {formatShiftRange(shift.start_at, shift.end_at)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ink/40">
                      Distancia
                    </p>
                    <p className="font-medium text-ink/80">
                      {distanceKm != null ? formatDistance(distanceKm) : "Sin datos"}
                    </p>
                  </div>
                  {(shift.tips || shift.meal) && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-ink/40">
                        Beneficios
                      </p>
                      <p className="font-medium text-ink/80">
                        {[shift.tips && "propinas", shift.meal && "comida"]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
