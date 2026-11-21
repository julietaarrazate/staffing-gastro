"use client";

import dynamic from "next/dynamic";
import { SKILL_LABELS, STATUS_LABELS, Shift } from "@/lib/types";
import { SKILL_ACCENT } from "@/lib/skill-style";
import { Badge, PortadaCielo, SinFoto } from "@/components/ui";
import { CalendarPlusIcon, CheckIcon, FlameIcon, ShieldIcon } from "@/components/icons";
import { formatAgo, formatDuration, formatShiftWhen, shiftDurationMinutes } from "@/lib/datetime";
import { payView } from "@/lib/pay";
import { effectiveStatus } from "@/lib/shift-next-step";
import ShiftLifecycleStepper from "@/components/ShiftLifecycleStepper";
import { CLASE_TONO, TONO_ESTADO } from "@/components/worker/TurnoSuave";

// Sólo aparece mientras alguien va en camino: no pesa en todas las filas.
const EnRouteMap = dynamic(() => import("@/components/employer/EnRouteMap"), {
  ssr: false,
  loading: () => <div data-skeleton className="h-36 w-full animate-pulse rounded-2xl bg-surface" />,
});

// Mismos criterios que `ShiftCard`: lo que ya no tiene nada pendiente queda
// apagado («finalizado» no: todavía falta registrar el pago), y el aviso de
// pago bajo (ADR-0012) sólo mientras el turno todavía se puede corregir.
const APAGADOS = new Set(["cancelado", "pagado", "no_cubierto"]);
const CON_AVISO_DE_PAGO = new Set(["borrador", "publicado", "buscando_personal"]);

/**
 * Un turno en el panel del comercio, con la dirección suave (ADR-0028,
 * maquetas `C-Panel*`): una fila blanca con sombra difusa. A la izquierda,
 * quién lo cubre (su inicial sobre el cielo de `SinFoto`) o, mientras no lo cubre nadie, el cielo con
 * el ícono del puesto (`PortadaCielo`: sin el bloque de color por rubro); al
 * lado el puesto, el horario y el lugar, y a la derecha el estado en palabras
 * y el pago.
 *
 * Muestra los mismos datos que la comanda de `ShiftCard` del lado del
 * comercio (el aviso de pago bajo, los pasos, «va en camino»); las acciones
 * llegan como `children`. `ShiftCard` no cambia: la siguen usando las
 * pantallas que no migraron.
 */
export default function TurnoPanel({ shift, children }: { shift: Shift; children?: React.ReactNode }) {
  const { Icon } = SKILL_ACCENT[shift.position];
  const apagado = APAGADOS.has(shift.status);
  const pay = payView(shift);
  const durationMin = shiftDurationMinutes(shift.start_at, shift.end_at);
  const tono = TONO_ESTADO[shift.status] ?? "azul";
  const conPersona = Boolean(shift.worker_name) && shift.status !== "cancelado";
  const enViaje = shift.en_route_at != null && effectiveStatus(shift) === "en_camino";

  return (
    <article
      data-testid="shift-card"
      data-shift-id={shift.id}
      data-turno="fila"
      className={`turno-fila no-select flex flex-col gap-3 p-2.5 pr-3.5 ${apagado ? "turno-apagado" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-end gap-x-3 gap-y-1.5">
        <div className="flex min-w-[min(100%,11rem)] flex-1 items-start gap-3">
          {conPersona ? (
            <span className="block h-[46px] w-[46px] shrink-0 overflow-hidden rounded-full">
              <SinFoto nombre={shift.worker_name} id={shift.worker_profile_id} tamano={46} />
            </span>
          ) : (
            <span className="relative block h-[46px] w-[46px] shrink-0 overflow-hidden rounded-[14px]">
              <PortadaCielo id={shift.id} Icon={Icon} mini />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-fila font-bold text-ink [overflow-wrap:anywhere]">
              {SKILL_LABELS[shift.position]}
              {shift.urgent && (
                <span className="ml-2 inline-flex items-center gap-0.5 align-middle text-xs font-bold text-danger-text">
                  <FlameIcon size={12} /> Urgente
                </span>
              )}
            </h3>
            {/* Horario en 24 h y con la duración («Hoy · 20:00 – 02:00 · 6 h»). */}
            <p className="text-caption text-ink">
              {formatShiftWhen(shift.start_at, shift.end_at)}
              {durationMin != null && (
                <span className="whitespace-nowrap text-ink-soft"> · {formatDuration(durationMin)}</span>
              )}
            </p>
            <p className="text-caption text-ink-soft [overflow-wrap:anywhere]">
              {conPersona && <span className="font-semibold text-ink">{shift.worker_name} · </span>}
              {shift.city ?? "Ubicación a confirmar"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5 pt-0.5">
          <p className={`inline-flex items-center gap-1 text-caption font-bold ${CLASE_TONO[tono]}`}>
            {tono === "verde" && <CheckIcon size={14} aria-hidden />}
            <span data-testid="shift-status">{STATUS_LABELS[shift.status]}</span>
          </p>
          <p className="text-fila font-extrabold tracking-tight text-ink">
            <span className="sr-only">Pago: </span>
            {pay.amount}
            {pay.suffix && <span className="ml-1 text-xs font-bold text-ink-soft">{pay.suffix}</span>}
          </p>
        </div>
      </div>

      {pay.note && (
        <p className="text-xs font-medium text-ink-soft">
          {pay.kind === "por_hora" ? "Se paga lo que reste desde que llegue el reemplazo" : pay.note}
        </p>
      )}
      {(shift.tips || shift.meal || shift.company_verified || shift.event_name) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {shift.tips && <span className="chip-suave">+ propinas</span>}
          {shift.meal && <span className="chip-suave">+ comida</span>}
          {shift.company_verified && (
            <Badge tone="trust" icon={<ShieldIcon size={11} />}>
              Comercio verificado
            </Badge>
          )}
          {shift.event_name && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-primary-text">
              <CalendarPlusIcon size={12} /> {shift.event_name}
            </span>
          )}
        </div>
      )}

      {/* Información, no un reto (ADR-0012): manteca, no el rojo de error. */}
      {shift.pay_band === "por_debajo" && CON_AVISO_DE_PAGO.has(shift.status) && (
        <p className="rounded-[14px] bg-manteca-tint px-3 py-2 text-xs font-semibold text-manteca-text">
          Paga por debajo de lo habitual para este puesto en la zona. Los turnos así suelen tardar más en
          cubrirse.
        </p>
      )}

      <ShiftLifecycleStepper shift={shift} perspective="employer" caption="cutShort" variante="barras" />

      {/* «Va en camino»: sólo mientras la persona comparte el viaje. El backend
          borra estos campos al marcar la llegada. */}
      {enViaje &&
        (shift.en_route_latitude != null &&
        shift.en_route_longitude != null &&
        shift.latitude != null &&
        shift.longitude != null ? (
          <EnRouteMap
            venueLatitude={shift.latitude}
            venueLongitude={shift.longitude}
            workerLatitude={shift.en_route_latitude}
            workerLongitude={shift.en_route_longitude}
            reportedAt={shift.en_route_at as string}
            workerName={shift.worker_name}
          />
        ) : (
          // Sin coordenadas no hay mapa, pero el viaje existe: hace cuánto fue
          // la última señal y por qué no se dibuja.
          <div data-testid="en-route-note" className="caja-resena px-3 py-2">
            <p className="text-sm font-semibold text-ink">Última señal: {formatAgo(shift.en_route_at as string)}</p>
            {(shift.latitude == null || shift.longitude == null) && (
              <p className="text-xs text-ink-soft">Sin mapa: este turno no tiene la ubicación marcada.</p>
            )}
          </div>
        ))}

      {children && <div>{children}</div>}
    </article>
  );
}
