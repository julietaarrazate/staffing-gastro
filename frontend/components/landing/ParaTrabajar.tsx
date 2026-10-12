"use client";

import Link from "next/link";
import OpportunityCard from "@/components/worker/OpportunityCard";
import { CheckIcon } from "@/components/icons";
import { PhoneFrame, PushNotice } from "./replicas";
import Reveal from "./Reveal";
import { useStoryShift } from "./useStoryShift";

// backend/app/modules/shift/application/services.py (aviso a los cercanos)
const PUSH_TURNO = {
  title: "Turno de Mozo/a cerca tuyo",
  body: "Tu bar está buscando Mozo/a. Entrá y postulate antes de que lo tomen.",
};

/**
 * La sección de quien trabaja, con su ancla (`#trabajar`, el link del
 * encabezado). Hasta el 2026-10-12 el trabajador sólo tenía un botón gemelo
 * en el hero y una línea en precios: ahora tiene qué gana, cómo empezar y su
 * propio botón. Cada punto es una regla real: pago directo y sin cobro al
 * trabajador (planes en backend/app/modules/subscription), reputación de
 * turnos hechos (ADR-0013), ubicación sólo en camino (ADR-0014), DNI y selfie
 * (ADR-0010).
 */
const PUNTOS = [
  "Ves cuánto paga, a qué hora y a qué distancia antes de postularte",
  "Te paga directo el local. Oído no te cobra nada",
  "Tu reputación se arma con turnos reales y te ayuda a que te elijan",
  "Tu ubicación, sólo cuando avisás que vas en camino",
];

const PASOS = ["Creá tu perfil", "Verificá tu identidad con DNI y selfie", "Activá los avisos para que te lleguen los turnos"];

export default function ParaTrabajar() {
  const shift = useStoryShift("publicado");
  return (
    <section
      id="trabajar"
      aria-labelledby="trabajar-titulo"
      data-tone="paper"
      className="scroll-mt-[var(--lht)] bg-paper px-4 py-20 sm:px-6 lg:grid lg:grid-cols-12 lg:items-center lg:gap-12 lg:px-12 lg:py-28"
    >
      <div className="lg:col-span-7">
        <p className="font-mono text-caption font-medium uppercase tracking-[0.12em] text-primary-text">Para trabajar</p>
        <h2
          id="trabajar-titulo"
          className="mt-3 font-display text-poster font-semibold tracking-[-0.015em] text-ink [text-wrap:balance]"
        >
          Turnos de gastronomía cerca tuyo, cuando quieras
        </h2>
        <ul className="mt-10 grid gap-4">
          {PUNTOS.map((p) => (
            <li key={p} className="flex items-start gap-3 text-lg text-ink">
              <CheckIcon size={20} aria-hidden className="mt-1 shrink-0 text-secondary-text" />
              {p}
            </li>
          ))}
        </ul>

        <h3 className="mt-12 font-display text-h2 font-semibold text-ink">Cómo empezar</h3>
        <ol className="mt-5 grid gap-3 sm:grid-cols-3">
          {PASOS.map((p, i) => (
            <li key={p} className="flex items-start gap-3 rounded-[var(--radius-card)] bg-card p-4 text-body text-ink ring-1 ring-line">
              <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-night font-mono text-caption font-medium text-white">
                {i + 1}
              </span>
              {p}
            </li>
          ))}
        </ol>

        <Link
          href="/register?rol=trabajador"
          data-cta="trabajar"
          className="mt-10 inline-flex h-14 w-full items-center justify-center rounded-[var(--radius-btn)] bg-night px-8 text-lg font-semibold text-white transition duration-200 active:scale-[0.96] hover:brightness-150 sm:w-auto"
        >
          Crear mi perfil gratis
        </Link>
        <p className="mt-4 max-w-[48ch] text-caption text-ink-soft">
          Oído funciona desde el navegador del celular, sin bajar nada. Para que te lleguen los avisos, activá las
          notificaciones (en iPhone, primero agregá Oído a tu pantalla de inicio).
        </p>
      </div>

      {/* El celular de Lucía sólo en pantallas anchas: en el celular la
          sección ya es larga y la lista dice lo mismo. */}
      <Reveal className="mt-14 hidden justify-center lg:col-span-5 lg:mt-0 lg:flex" delay={120}>
        <div inert aria-hidden className="no-select">
          <PhoneFrame hora="20:48">
            <div className="relative h-[504px] px-2.5">
              <PushNotice title={PUSH_TURNO.title} body={PUSH_TURNO.body} />
              <div className="absolute inset-x-2.5 top-[7.25rem] h-[285px] w-[240px]">
                <div className="h-[380px] w-[320px] origin-top-left scale-[0.75]">
                  <OpportunityCard shift={shift} distanceKm={0.6} preview />
                </div>
              </div>
            </div>
          </PhoneFrame>
        </div>
      </Reveal>
    </section>
  );
}
