"use client";

import { Modal } from "@/components/ui";
import { SKILL_LABELS, Shift } from "@/lib/types";
import { formatShiftRange } from "@/lib/datetime";
import { distanceOf } from "@/lib/current-location";
import { formatMoney, formatPayAmount, payPerHour } from "@/lib/pay";
import { formatDistance } from "@/lib/format";

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
                    <p className="text-label font-bold font-mono uppercase tracking-wide text-ink/40">Pago</p>
                    <p className="text-base font-extrabold leading-tight text-primary-text">
                      {formatPayAmount(shift)}
                    </p>
                  </div>
                  {perHour !== null && (
                    <div>
                      <p className="text-label font-bold font-mono uppercase tracking-wide text-ink/40">
                        Por hora
                      </p>
                      <p className="font-semibold text-ink">
                        {formatMoney(perHour, shift.currency)}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-label font-bold font-mono uppercase tracking-wide text-ink/40">Cuándo</p>
                    <p className="font-medium leading-snug text-ink/80">
                      {formatShiftRange(shift.start_at, shift.end_at)}
                    </p>
                  </div>
                  <div>
                    <p className="text-label font-bold font-mono uppercase tracking-wide text-ink/40">
                      Distancia
                    </p>
                    <p className="font-medium text-ink/80">
                      {distanceKm != null ? formatDistance(distanceKm) : "Sin datos"}
                    </p>
                  </div>
                  {(shift.tips || shift.meal) && (
                    <div>
                      <p className="text-label font-bold font-mono uppercase tracking-wide text-ink/40">
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
