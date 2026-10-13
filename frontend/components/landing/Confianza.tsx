"use client";

import IdentityVerifiedBadge from "@/components/IdentityVerifiedBadge";
import { Avatar } from "@/components/ui";
import { MapPinIcon, ShieldIcon, StarIcon, XCircleIcon } from "@/components/icons";
import { formatDecimal1 } from "@/lib/format";
import { CANDIDATES } from "./fixtures";
import Reveal from "./Reveal";

/**
 * Confianza, del lado del comercio: la ficha de quien le va a entrar al salón
 * y cuatro reglas cortas. Cada una es una regla real del producto:
 * - identidad verificada con DNI y selfie: ADR-0010;
 * - reseñas sólo de turnos hechos: ADR-0013;
 * - no se presentó: ADR-0007;
 * - ubicación sólo en camino: ADR-0014 y "va en camino" (#320).
 * Lo que ve el trabajador del comercio está en ParaTrabajar.tsx.
 */
const LUCIA = CANDIDATES[0];

const REGLAS = [
  { icon: <ShieldIcon size={20} />, texto: "Identidad verificada" },
  { icon: <StarIcon size={20} />, texto: "Reseñas sólo de turnos hechos en Oído, nadie se las pone solo" },
  { icon: <XCircleIcon size={20} />, texto: "¿No vino? La marcás y elegís a otra persona sin volver a publicar" },
  { icon: <MapPinIcon size={20} />, texto: "Ves su ubicación sólo mientras viene en camino" },
];

export default function Confianza() {
  return (
    <section
      aria-labelledby="confianza-titulo"
      data-tone="light"
      className="px-4 py-20 sm:px-6 lg:grid lg:grid-cols-12 lg:items-center lg:gap-12 lg:px-12 lg:py-28"
    >
      <div className="lg:col-span-6">
        <h2
          id="confianza-titulo"
          className="font-display text-poster font-semibold tracking-[-0.015em] text-ink [text-wrap:balance]"
        >
          Sabés quién entra a tu salón
        </h2>
        <ul className="mt-10 grid gap-5">
          {REGLAS.map((r, i) => (
            <Reveal as="li" key={r.texto} delay={i * 90} className="flex items-start gap-3.5 text-lg text-ink">
              <span aria-hidden className="mt-1 shrink-0 text-primary-text">
                {r.icon}
              </span>
              {r.texto}
            </Reveal>
          ))}
        </ul>
      </div>
      <Reveal className="mt-12 lg:col-span-5 lg:col-start-8 lg:mt-0" delay={120}>
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
