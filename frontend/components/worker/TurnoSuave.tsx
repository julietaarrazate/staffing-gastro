"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { SKILL_LABELS, STATUS_LABELS, Shift } from "@/lib/types";
import { Badge, Button, NubesCielo, variantePorId } from "@/components/ui";
import { CalendarPlusIcon, CheckIcon, FlameIcon, RouteIcon, ShieldIcon } from "@/components/icons";
import { formatDuration, formatShiftWhenLive, shiftDurationMinutes } from "@/lib/datetime";
import { diaCortoArgentina } from "@/lib/semana";
import { payView } from "@/lib/pay";
import { downloadShiftIcs } from "@/lib/calendar";
import { reportShiftHref } from "@/lib/support-reference";
import ShiftLifecycleStepper from "@/components/ShiftLifecycleStepper";

const MiniMap = dynamic(() => import("@/components/MiniMap"), {
  ssr: false,
  loading: () => <div data-skeleton className="h-28 w-full animate-pulse rounded-2xl bg-surface" />,
});

// Mismos criterios que `ShiftCard` (la tarjeta del panel del comercio): lo
// que ya pasó no ofrece cómo llegar ni agendar, y lo que no tiene nada
// pendiente queda apagado.
const PASADOS = new Set(["cancelado", "finalizado", "pagado", "no_cubierto"]);
const APAGADOS = new Set(["cancelado", "pagado", "no_cubierto"]);

// El estado en palabras y con un color: verde lo que salió bien, rojo sólo lo
// cancelado, gris lo que no arrancó o no se cubrió y azul hondo lo que está
// en curso (los mismos grupos que los sellos de la comanda).
const TONO_ESTADO: Record<string, "verde" | "rojo" | "gris"> = {
  borrador: "gris",
  confirmado: "verde",
  check_in: "verde",
  finalizado: "verde",
  pagado: "verde",
  cancelado: "rojo",
  no_cubierto: "gris",
};
const CLASE_TONO = {
  verde: "text-success-text",
  rojo: "text-danger-text",
  gris: "text-ink-soft",
  azul: "text-primary-text",
} as const;

/**
 * Un turno de quien trabaja en Mis turnos, con la dirección suave (ADR-0028,
 * maqueta `T-Mis-turnos`). Dos formas:
 *
 * - `destacado` (el turno de hoy): una tarjeta con su propio cielo (el día,
 *   el puesto, el local y el horario y el pago en chips de vidrio) y, abajo,
 *   los cuatro pasos con sus barras y las acciones.
 * - la fila (todos los demás): el día en un bloque, el puesto, el horario y
 *   el local, y a la derecha el estado y el pago.
 *
 * Muestra los mismos datos y deja las mismas salidas que `ShiftCard` del lado
 * de quien trabaja (el comercio, cómo llegar, agendar, reportar); las
 * acciones del turno llegan como `children`. `ShiftCard` sigue siendo la
 * tarjeta del panel del comercio hasta su PR.
 */
export default function TurnoSuave({
  shift,
  destacado = false,
  showLifecycle = true,
  children,
}: {
  shift: Shift;
  destacado?: boolean;
  /** Un turno guardado todavía no tiene pasos: nadie se postuló. */
  showLifecycle?: boolean;
  children?: React.ReactNode;
}) {
  const pasado = PASADOS.has(shift.status);
  const apagado = APAGADOS.has(shift.status);
  const pay = payView(shift);
  const durationMin = shiftDurationMinutes(shift.start_at, shift.end_at);
  // «Ya empezó · hasta las 23:00 · 4 h» mentiría: ya no son 4 h (turno reofrecido).
  const duracion = durationMin != null && shift.hourly_pay_amount == null ? formatDuration(durationMin) : null;
  const [dia, ...restoCuando] = formatShiftWhenLive(shift).split(" · ");
  const horario = restoCuando.join(" · ");
  const diaEsFecha = /\d/.test(dia);
  const tono = TONO_ESTADO[shift.status] ?? "azul";
  const conMapa = shift.latitude != null && shift.longitude != null;
  const lugar = shift.city ?? "Ubicación a confirmar";

  const estado = (
    <>
      {tono === "verde" && <CheckIcon size={14} aria-hidden />}
      <span data-testid="shift-status">{STATUS_LABELS[shift.status]}</span>
    </>
  );

  // Lo que va debajo de la cabeza, igual en las dos formas.
  const cuerpo = (
    <>
      {pay.note && <p className="text-xs font-medium text-ink-soft">{pay.note}</p>}
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
      {shift.dress_code && <p className="text-xs text-ink-soft">Vestimenta: {shift.dress_code}</p>}
      {!pasado && (
        <>
          {/* El mapa, sólo en la tarjeta de hoy: en una lista de filas pesaba
              más que el turno. «Cómo llegar» sigue en todas. */}
          {destacado && conMapa && (
            <div className="overflow-hidden rounded-2xl">
              <MiniMap latitude={shift.latitude as number} longitude={shift.longitude as number} />
            </div>
          )}
          <div className="flex gap-2">
            {conMapa && (
              <Button
                variant="surface"
                size="sm"
                fullWidth
                className="boton-quieto"
                leftIcon={<RouteIcon size={15} />}
                onClick={() =>
                  window.open(
                    `https://www.google.com/maps/dir/?api=1&destination=${shift.latitude},${shift.longitude}`,
                    "_blank",
                    "noopener,noreferrer"
                  )
                }
              >
                Cómo llegar
              </Button>
            )}
            <Button
              variant="surface"
              size="sm"
              fullWidth
              className="boton-quieto"
              leftIcon={<CalendarPlusIcon size={15} />}
              onClick={() => downloadShiftIcs(shift)}
            >
              Agendar
            </Button>
          </div>
        </>
      )}
      {children && <div>{children}</div>}
      {/* U110: discreto, sin acento. */}
      <p className="text-center">
        <Link
          href={reportShiftHref(shift.id)}
          className="text-xs font-semibold text-ink-soft underline-offset-2 hover:text-ink hover:underline"
        >
          Reportar un problema
        </Link>
      </p>
    </>
  );

  if (destacado) {
    return (
      <article data-testid="shift-card" data-shift-id={shift.id} data-turno="destacado" className="tarjeta-destacada no-select">
        <div className="app-cielo cielo-limpio px-4 pb-4 pt-4">
          {/* Una nube chica arriba a la derecha, detrás de la letra en tinta. */}
          <NubesCielo nubes={[{ forma: variantePorId(shift.id), ancho: 130, pos: { right: 0, top: 4 } }]} />
          <p className="text-caption font-bold">{dia}</p>
          <h3 className="mt-0.5 break-words text-2xl font-extrabold leading-tight tracking-tight">
            {SKILL_LABELS[shift.position]}
          </h3>
          <p className="mt-0.5 break-words text-sm font-medium">
            {shift.company_name && (
              <>
                <Link href={`/companies/${shift.company_id}`} className="font-semibold underline-offset-2 hover:underline">
                  {shift.company_name}
                </Link>
                {" · "}
              </>
            )}
            {lugar}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="chip-vidrio">{estado}</span>
            {horario && (
              <span className="chip-vidrio">
                {horario}
                {duracion && ` · ${duracion}`}
              </span>
            )}
            <span className="chip-vidrio">
              <span className="sr-only">Pago: </span>
              {pay.amount}
              {pay.suffix && ` ${pay.suffix}`}
            </span>
            {shift.urgent && (
              <span className="chip-vidrio chip-urgente">
                <FlameIcon size={14} /> Urgente
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-3 p-4">
          {showLifecycle && (
            <ShiftLifecycleStepper shift={shift} perspective="worker" caption="cutShort" variante="barras" />
          )}
          {cuerpo}
        </div>
      </article>
    );
  }

  const fecha = diaCortoArgentina(shift.start_at);
  return (
    <article
      data-testid="shift-card"
      data-shift-id={shift.id}
      data-turno="fila"
      className={`turno-fila no-select flex flex-col gap-3 p-2.5 pr-3.5 ${apagado ? "turno-apagado" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-end gap-x-3 gap-y-1.5">
        <div className="flex min-w-[min(100%,11rem)] flex-1 items-start gap-3">
          <div className="turno-fecha flex h-[52px] w-[50px] shrink-0 flex-col items-center justify-center" aria-hidden>
            <span className="text-label font-bold text-ink-mute">{fecha.corto}</span>
            <span className="text-lg font-extrabold leading-tight text-ink">{fecha.numero}</span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="break-words text-fila font-bold text-ink">
              {SKILL_LABELS[shift.position]}
              {shift.urgent && (
                <span className="ml-2 inline-flex items-center gap-0.5 align-middle text-xs font-bold text-danger-text">
                  <FlameIcon size={12} /> Urgente
                </span>
              )}
            </h3>
            <p className="text-caption text-ink">
              {/* «Hoy», «Mañana» y «Ya empezó» se dicen; una fecha («sáb 21/11»)
                  ya está en el bloque y queda sólo para lectores de pantalla. */}
              {diaEsFecha ? <span className="sr-only">{dia} · </span> : `${dia} · `}
              {horario}
              {duracion && <span className="whitespace-nowrap text-ink-soft"> · {duracion}</span>}
            </p>
            <p className="break-words text-caption text-ink-soft">
              {shift.company_name && (
                <>
                  <Link
                    href={`/companies/${shift.company_id}`}
                    className="font-semibold text-ink underline-offset-2 hover:underline"
                  >
                    {shift.company_name}
                  </Link>
                  {" · "}
                </>
              )}
              {lugar}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5 pt-0.5">
          <p className={`inline-flex items-center gap-1 text-caption font-bold ${CLASE_TONO[tono]}`}>{estado}</p>
          <p className="text-fila font-extrabold tracking-tight text-ink">
            <span className="sr-only">Pago: </span>
            {pay.amount}
            {pay.suffix && <span className="ml-1 text-xs font-bold text-ink-soft">{pay.suffix}</span>}
          </p>
        </div>
      </div>
      {showLifecycle && (
        <ShiftLifecycleStepper shift={shift} perspective="worker" caption="cutShort" variante="barras" />
      )}
      {cuerpo}
    </article>
  );
}
