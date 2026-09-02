"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { SKILL_LABELS, STATUS_LABELS, Shift } from "@/lib/types";
import { SKILL_ACCENT, SKILL_HERO_GRADIENT } from "@/lib/skill-style";
import { Avatar, Badge, Button } from "@/components/ui";
import {
  CalendarIcon,
  CalendarPlusIcon,
  FlameIcon,
  MapPinIcon,
  RouteIcon,
  ShieldIcon,
  UsersIcon,
} from "@/components/icons";
import { formatShiftRange } from "@/lib/datetime";
import { cldThumb } from "@/lib/cloudinary";
import { downloadShiftIcs } from "@/lib/calendar";
import ShiftLifecycleStepper, { type ShiftStepperPerspective } from "@/components/ShiftLifecycleStepper";

const MiniMap = dynamic(() => import("@/components/MiniMap"), {
  ssr: false,
  loading: () => <div className="h-28 w-full animate-pulse rounded-2xl bg-surface" />,
});

// Ley de marca (docs/planning/PULIDO_ROADMAP.md): un solo acento por pantalla. Naranja
// para todo lo activo/publicado/en curso, verde sólo para éxito (confirmado
// además de los terminales finalizado/pagado), rojo sólo para cancelado, gris
// sólo para borrador. Nada de azul/amber sueltos (bug de la operadora: los
// turnos cancelados/aceptados se veían iguales).
const STATUS_COLORS: Record<string, string> = {
  borrador: "bg-surface text-ink/60",
  publicado: "bg-primary-tint text-primary-text",
  buscando_personal: "bg-primary-tint text-primary-text",
  asignado: "bg-primary-tint text-primary-text",
  confirmado: "bg-success-tint text-success-text",
  en_camino: "bg-primary-tint text-primary-text",
  check_in: "bg-primary-tint text-primary-text",
  trabajando: "bg-primary-tint text-primary-text",
  check_out: "bg-primary-tint text-primary-text",
  finalizado: "bg-success-tint text-success-text",
  pagado: "bg-success-tint text-success-text",
  cancelado: "bg-danger-tint text-danger-text",
};

// El turno ya pasó (finalizado/pagado/cancelado): no tiene sentido
// ofrecerle al trabajador indicaciones para llegar a un turno que ya
// terminó o que no va a pasar.
const PAST_STATUSES = new Set(["cancelado", "finalizado", "pagado"]);

// La tarjeta entera se atenúa (opacity) para que, en una lista mixta, se
// note de un vistazo qué turno sigue vivo y cuál ya no. El color del chip
// (verde/rojo) sigue siendo la señal principal; la opacidad es un refuerzo.
//
// OJO: a diferencia de `PAST_STATUSES`, acá "finalizado" (el trabajador ya
// hizo check-out) NO cuenta — antes sí, y la tarjeta se veía "apagada" apenas
// terminaba el turno aunque todavía faltara "Marcar como pagado" y calificar
// (Julieta, 2026-08-11: "eso debería ser un paso final ... recién cuando
// terminás que quede en ese color"). El look atenuado queda reservado a los
// dos estados donde ya no queda ninguna acción pendiente: `pagado` (el
// comercio ya confirmó el pago) y `cancelado`. La calificación sigue siendo
// opcional a propósito (no bloquea el pago ni el look de "terminado") —
// forzarla dejaría turnos sin calificar atascados con el look de "algo
// falta" para siempre.
const DIMMED_STATUSES = new Set(["cancelado", "pagado"]);

export default function ShiftCard({
  shift,
  perspective = "employer",
  showLifecycle = true,
  children,
}: {
  shift: Shift;
  /** "employer" (default, `/shifts`): Publicado→Asignado→En curso→Finalizado.
   *  "worker" (`/my-shifts`): Postulado→Aceptado→En curso→Finalizado. */
  perspective?: ShiftStepperPerspective;
  /** El stepper asume que el trabajador YA tiene alguna relación con el
   * turno (se postuló o lo asignaron) — el paso 1 dice literalmente
   * "Postulado". Un turno guardado (`/my-shifts`, tab Guardados) todavía
   * no tiene ninguna relación: mostrar el stepper ahí diría "Postulado"
   * sobre un turno al que el trabajador ni se postuló. */
  showLifecycle?: boolean;
  children?: React.ReactNode;
}) {
  const { Icon } = SKILL_ACCENT[shift.position];
  const isPast = PAST_STATUSES.has(shift.status);
  const isDimmed = DIMMED_STATUSES.has(shift.status);
  // Igual que en `OpportunityCard`: si la foto del comercio falla al cargar,
  // se cae al gradiente del rubro en vez de dejar un banner roto.
  const [broken, setBroken] = useState(false);
  const hasPhoto = Boolean(shift.company_logo_url) && !broken;

  return (
    // `.no-select` (bug C0 #2, docs/planning/PULIDO_ROADMAP.md fix 2): esta tarjeta es
    // chrome de UI para tocar/accionar (rubro, chip de estado, fecha,
    // cantidad, dress code), no contenido de lectura genuino — se podía
    // seleccionar como una página web (captura de la operadora). El único
    // texto de lectura real que cuelga de acá (comentario de reseña ya
    // escrito, ver ReviewBox) se reactiva puntualmente con `.select-text`.
    <div
      data-testid="shift-card"
      data-shift-id={shift.id}
      // Antes tenía `overflow-hidden` (sólo para redondear la esquina de arriba
      // del link al comercio). Eso también cortaba cualquier hijo que necesite
      // salirse de la tarjeta — el menú "Más" de ShiftActions, que es un
      // dropdown `position: absolute`, quedaba tapado/recortado en una tira
      // finita en vez de mostrarse completo (bug real con captura, Julieta
      // 2026-07-29). El link de arriba ahora redondea sus propias esquinas.
      className={`no-select rounded-[var(--radius-card)] bg-card shadow-[var(--shadow-soft)] ring-1 ring-line transition active:scale-[0.99] ${
        isDimmed ? "opacity-65 saturate-[0.85]" : ""
      }`}
    >
      {/* BANNER (Julieta, captura 2026-08-17: "todas las publicaciones son
          genéricas, sin fotos, sin distinto color de banner... la idea es que
          entre tantas tengan distinto color, al menos un corte de otro color
          hasta la parte donde muestra los pasos 1 2 3 4"). Antes esta tarjeta
          era íntegramente blanca con un chip chico de color por rubro: en una
          lista de varias, todas se leían iguales. Ahora arranca con el mismo
          tratamiento que `OpportunityCard`: foto real del local si el
          comercio la subió, y si no el gradiente del rubro
          (`SKILL_HERO_GRADIENT`) — así dos turnos seguidos se distinguen de
          un vistazo. El corte va justo hasta el bloque de estado + pasos, que
          quedan sobre blanco.

          `overflow-hidden` va ACÁ y no en la raíz: la raíz lo tenía y
          recortaba el menú "Más" de `ShiftActions` (dropdown absolute) a una
          tira finita (bug real con captura, Julieta 2026-07-29). */}
      <div className="relative overflow-hidden rounded-t-[var(--radius-card)]">
        {hasPhoto ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cldThumb(shift.company_logo_url, 800)}
              alt={shift.company_name ?? "Local"}
              onError={() => setBroken(true)}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/35" />
          </>
        ) : (
          <div className={`absolute inset-0 ${SKILL_HERO_GRADIENT[shift.position]}`}>
            {/* Velo: los extremos claros de algunos gradientes (ámbar, naranja)
                no dan contraste suficiente para el texto blanco por sí solos. */}
            <div className="absolute inset-0 bg-black/15" />
            <Icon size={132} className="absolute -right-5 -top-6 text-white/15" />
          </div>
        )}

        <div className="relative px-5 pb-4 pt-3.5">
          <div className="flex items-start justify-between gap-2">
            {/* El sello de verificación va COMO HERMANO de la pastilla del
                comercio, no adentro: `Badge` ya es una pastilla con fondo
                propio, y anidarla dentro de la pastilla blanca daba dos
                píldoras encastradas. */}
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {shift.company_name && (
                <Link
                  href={`/companies/${shift.company_id}`}
                  className="inline-flex min-w-0 items-center gap-2 rounded-full bg-white/95 py-1 pl-1 pr-3 shadow-sm backdrop-blur"
                >
                  <Avatar src={shift.company_logo_url} name={shift.company_name} size="sm" />
                  <span className="truncate text-sm font-semibold text-ink/80">
                    {shift.company_name}
                  </span>
                </Link>
              )}
              {/* ADR-0011: única señal de confianza del comercio visible en
                  el feed del trabajador hoy — antes no había ninguna. */}
              {shift.company_verified && (
                <Badge tone="trust" icon={<ShieldIcon size={11} />} className="shadow-sm">
                  Comercio verificado
                </Badge>
              )}
            </div>
            {shift.urgent && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-danger-text shadow-sm backdrop-blur">
                <FlameIcon size={13} /> Urgente
              </span>
            )}
          </div>

          {/* Turno publicado como parte de un evento masivo (varios roles a la
              vez, ver /shifts/new-event): se marca para poder identificarlo
              aunque la familia de estado lo separe de sus hermanos. */}
          {shift.event_name && (
            <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold text-white backdrop-blur">
              <CalendarPlusIcon size={12} /> {shift.event_name}
            </p>
          )}

          <h3 className="mt-3 text-2xl font-extrabold leading-tight text-white drop-shadow">
            {SKILL_LABELS[shift.position]}
          </h3>
          <p className="mt-0.5 inline-flex items-center gap-1 text-sm font-medium text-white/85">
            <MapPinIcon size={13} />
            {shift.city ?? "Ubicación a confirmar"}
          </p>

          {/* Jerarquía brutal (ART_DIRECTION.md §9.4, §6.2 punto 1): el pago
              tiene que dominar la tarjeta, no empatar con el título del
              puesto. Mismo patrón de label+número que `OpportunityCard`, para
              que las dos tarjetas se lean de la misma app (criterio 4 de
              aprobación, §17). */}
          <div className="mt-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-white/70">Pago</p>
            <p className="text-3xl font-extrabold leading-none tracking-tight text-white drop-shadow">
              {shift.currency} {Number(shift.pay_amount).toLocaleString("es-AR")}
            </p>
            {shift.tips && <p className="mt-1 text-xs font-medium text-white/75">+ propinas</p>}
            {shift.meal && <p className="text-xs font-medium text-white/75">+ comida</p>}
          </div>
        </div>
      </div>

      <div className="px-5 pb-5 pt-4">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-bold ${
              STATUS_COLORS[shift.status] ?? "bg-surface text-ink/70"
            }`}
          >
            {STATUS_LABELS[shift.status]}
          </span>
        </div>

        {/* Stepper del ciclo de vida (docs/planning/PULIDO_ROADMAP.md, inspiración
            Clickie): de un vistazo, en qué punto del viaje está el turno. */}
        {showLifecycle && (
          <ShiftLifecycleStepper shift={shift} perspective={perspective} className="mt-3" />
        )}

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-ink/70">
          <span className="inline-flex items-center gap-1.5">
            <CalendarIcon size={15} className="text-ink/35" />
            {formatShiftRange(shift.start_at, shift.end_at)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <UsersIcon size={15} className="text-ink/35" />
            {shift.quantity} persona(s)
          </span>
        </div>

        {shift.dress_code && (
          <p className="mt-2 text-xs text-ink/50">Dress code: {shift.dress_code}</p>
        )}

        {/* Mini-mapa + "Cómo llegar"/"Agendar": sólo tiene sentido del lado
            del trabajador (es quien tiene que viajar hasta el local y
            organizarse el día). Del lado del comercio estaba al revés — la
            tarjeta de SU PROPIO turno le ofrecía indicaciones para llegar a
            su propio local, ruido puro (Julieta, 2026-07-29). Se oculta en
            turnos ya terminados/cancelados: no hay nada que agendar de un
            turno que ya pasó. */}
        {perspective === "worker" && !isPast && (
          <>
            {shift.latitude != null && shift.longitude != null && (
              <div className="mt-3 overflow-hidden rounded-2xl ring-1 ring-line">
                <MiniMap latitude={shift.latitude} longitude={shift.longitude} />
              </div>
            )}
            <div className="mt-2 flex gap-2">
              {shift.latitude != null && shift.longitude != null && (
                <Button
                  variant="surface"
                  size="sm"
                  fullWidth
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
                leftIcon={<CalendarPlusIcon size={15} />}
                onClick={() => downloadShiftIcs(shift)}
              >
                Agendar
              </Button>
            </div>
          </>
        )}

        {children && <div className="mt-4">{children}</div>}
      </div>
    </div>
  );
}
