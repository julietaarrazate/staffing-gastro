"use client";

import IdentityVerifiedBadge from "@/components/IdentityVerifiedBadge";
import { Avatar } from "@/components/ui";
import { StarIcon } from "@/components/icons";
import { formatDecimal1 } from "@/lib/format";
import { CANDIDATES } from "./fixtures";
import Reveal from "./Reveal";

/**
 * Confianza, del lado del comercio: la ficha de quien le va a entrar al salón.
 * Desde el 2026-10-18 va sola, sin la lista de reglas debajo (Julieta: "en
 * el cuadro ya se entiende todo"); las reglas siguen en las preguntas
 * frecuentes y en la app (identidad: ADR-0010; reseñas de turnos hechos:
 * ADR-0013). Lo que ve el trabajador está en ParaTrabajar.tsx.
 */
const LUCIA = CANDIDATES[0];

export default function Confianza() {
  return (
    <section aria-labelledby="confianza-titulo" data-tone="light" className="landing-sec landing-sec-dos">
      <h2 id="confianza-titulo" className="landing-h2">
        Sabés quién entra a tu salón
      </h2>
      <Reveal className="landing-sec-cosa w-full max-w-[420px] text-left" delay={120}>
        <FichaTrabajador />
      </Reveal>
    </section>
  );
}

/** Lo que ve el comercio de quien le va a entrar al salón (datos de ejemplo). */
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
      {/* La barrita del plan Pro (Precios): ámbar a celeste, como divisor. */}
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
    </div>
  );
}
