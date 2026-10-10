"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useInView } from "motion/react";
import Badge from "@/components/ui/Badge";
import IdentityVerifiedBadge from "@/components/IdentityVerifiedBadge";
import { Avatar } from "@/components/ui";
import {
  CalendarIcon,
  FlameIcon,
  GlassIcon,
  MapPinIcon,
  ShieldIcon,
  StarIcon,
  XCircleIcon,
} from "@/components/icons";
import { formatDecimal1 } from "@/lib/format";
import { BARRIO, CANDIDATES, LOCAL as LOCAL_NOMBRE } from "./fixtures";
import { setReloj } from "./relojStore";
import { useStory } from "./Stage";

/**
 * CONFIANZA. El segundo silencio: nada se mueve. Cada lado tiene UNA pieza del
 * producto (la ficha de quien viene, la ficha de quien paga) y debajo dos
 * reglas cortas con ícono. Antes eran ocho renglones etiqueta/dato y se leía
 * como un formulario (Julieta, 2026-10-10). Cada dato es una regla real:
 * - identidad y verificación del comercio: ADR-0010 y ADR-0013;
 * - no se presentó: ADR-0007; pasa a urgente a los 8 minutos: ADR-0009
 *   (ESCALATION_DELAY en backend/app/modules/shift/application/services.py);
 * - ubicación: ADR-0014 y "va en camino" (#320); postulaciones que se pisan:
 *   `_withdraw_overlapping_applications` al confirmar.
 * Lucía y Tu bar son los mismos de la historia (fixtures.ts).
 */
const LUCIA = CANDIDATES[0];

export default function Confianza() {
  const ref = useRef<HTMLElement>(null);
  const { enhanced } = useStory();
  // La historia terminó: de acá para abajo no hay reloj. El margen de arriba
  // enorme hace que cuente también estar más abajo (la sección ya pasó):
  // si se llega de un salto, nunca estuvo "a la vista".
  const inView = useInView(ref, { margin: "100000px 0px -85% 0px" });
  useEffect(() => {
    if (enhanced && inView) setReloj(null);
  }, [enhanced, inView]);

  return (
    <section
      ref={ref}
      aria-label="Confianza"
      data-fin-historia
      data-tone="light"
      className="px-4 py-20 sm:px-6 lg:grid lg:grid-cols-12 lg:gap-12 lg:px-12 lg:py-28"
    >
      <h2 className="font-display text-poster font-semibold tracking-[-0.03em] text-ink [text-wrap:balance] lg:col-span-4 lg:text-[length:var(--text-poster)]">
        Sabés quién viene. <span className="font-medium text-ink-soft">Y ella sabe a dónde va.</span>
      </h2>
      <div className="mt-12 grid gap-12 lg:col-span-7 lg:col-start-6 lg:mt-0 lg:grid-cols-2 lg:gap-10">
        <Lado
          titulo="Si tenés un local"
          ficha={<FichaTrabajador />}
          reglas={[
            { icon: <XCircleIcon size={18} />, texto: "¿No vino? Lo marcás y elegís a otra persona sin volver a publicar." },
            { icon: <FlameIcon size={18} />, texto: "¿Nadie lo toma? A los 8 minutos pasa a urgente y le llega a más gente." },
          ]}
        />
        <Lado
          titulo="Si trabajás"
          ficha={<FichaComercio />}
          reglas={[
            { icon: <MapPinIcon size={18} />, texto: "Tu ubicación, sólo cuando la prendés vos. Nunca el recorrido." },
            { icon: <CalendarIcon size={18} />, texto: "Confirmás un turno y se bajan solas las postulaciones que se pisan." },
          ]}
        />
      </div>
    </section>
  );
}

function Lado({
  titulo,
  ficha,
  reglas,
}: {
  titulo: string;
  ficha: ReactNode;
  reglas: { icon: ReactNode; texto: string }[];
}) {
  return (
    <div className="flex flex-col">
      <p className="font-mono text-label font-medium uppercase tracking-[0.14em] text-primary-text">{titulo}</p>
      {/* flex-1 + h-full en la ficha: en compu las dos fichas terminan a la
          misma altura y las reglas de abajo arrancan alineadas. */}
      <div className="mt-4 flex-1">{ficha}</div>
      <ul className="mt-5 grid gap-3">
        {reglas.map((r) => (
          <li key={r.texto} className="flex items-start gap-3 text-body text-ink">
            <span aria-hidden className="mt-0.5 shrink-0 text-ink-mute">
              {r.icon}
            </span>
            {r.texto}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Lo que ve el comercio de quien le va a entrar al salón. */
function FichaTrabajador() {
  const datos = [
    { v: formatDecimal1(LUCIA.rating ?? 0), k: "reseñas", star: true },
    { v: `${Math.round((LUCIA.punctuality_rate ?? 0) * 100)}%`, k: "puntual" },
    { v: String(LUCIA.events_completed ?? 0), k: "turnos" },
  ];
  return (
    <div className="h-full rounded-[var(--radius-card)] bg-glow p-5 shadow-[var(--shadow-float)] ring-1 ring-line">
      <div className="flex items-center gap-3">
        <Avatar src={null} name={LUCIA.full_name} size="lg" />
        <div className="min-w-0">
          <p className="font-display text-xl font-semibold text-ink">{LUCIA.full_name}</p>
          <p className="text-sm text-ink-mute">Moza · {LUCIA.years_experience} años</p>
        </div>
      </div>
      <div className="mt-4">
        <IdentityVerifiedBadge verified />
      </div>
      {/* La barrita del plan Pro (Carta): ámbar a celeste, como divisor. */}
      <div aria-hidden className="mt-4 h-1.5 w-full rounded-full bg-gradient-to-r from-primary to-secondary-strong" />
      <dl className="mt-4 grid grid-cols-3 divide-x divide-line text-center">
        {datos.map((d) => (
          <div key={d.k}>
            <dd className="inline-flex items-center gap-1 font-mono text-lg font-medium tabular-nums text-ink">
              {d.star && <StarIcon size={14} filled className="text-rating" />}
              {d.v}
            </dd>
            <dt className="text-xs text-ink-mute">{d.k}</dt>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm text-ink-soft">
        Su DNI y su selfie los revisó una persona. Las reseñas salen de turnos hechos en Oído: nadie se las pone solo.
      </p>
    </div>
  );
}

/** Lo que ve el trabajador de quien le va a pagar. */
function FichaComercio() {
  return (
    <div className="h-full rounded-[var(--radius-card)] bg-glow p-5 shadow-[var(--shadow-float)] ring-1 ring-line">
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid size-16 shrink-0 place-items-center rounded-2xl bg-card ring-1 ring-line">
          <GlassIcon size={26} className="text-ink" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-xl font-semibold text-ink">{LOCAL_NOMBRE}</p>
          <p className="text-sm text-ink-mute">Bar · {BARRIO}</p>
        </div>
      </div>
      <div className="mt-4">
        <Badge tone="trust" icon={<ShieldIcon size={11} />}>
          Comercio verificado
        </Badge>
      </div>
      {/* Mismo tratamiento que los precios de los planes (Carta): número en
          tinta, sin bloque de color, para no cargar de celeste la sección. */}
      {/* La barrita del plan Pro (Carta): ámbar a celeste, como divisor. */}
      <div aria-hidden className="mt-4 h-1.5 w-full rounded-full bg-gradient-to-r from-primary to-secondary-strong" />
      <div className="mt-4">
        <p className="font-mono text-label font-medium uppercase tracking-[0.12em] text-ink-mute">Te paga directo</p>
        <p className="mt-1 flex items-baseline gap-1">
          <span className="font-display text-price font-semibold tracking-[-0.03em] tabular-nums text-ink">$70.000</span>
          <span className="whitespace-nowrap text-body text-ink-mute">por el turno</span>
        </p>
        <p className="text-sm text-ink-soft">Sin comisión ni intermediarios.</p>
      </div>
      <p className="mt-4 text-sm text-ink-soft">Su constancia de AFIP la revisó una persona.</p>
    </div>
  );
}
