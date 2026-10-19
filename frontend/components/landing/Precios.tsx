"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatArs } from "@/lib/format";
import type { SubscriptionPlan } from "@/lib/types";
import { RESPALDO } from "./planes";
import Reveal from "./Reveal";

/**
 * PRECIOS. Responde "¿cuánto sale?" una vez que se entendió qué hace. Desde
 * el 2026-10-18 cada plan muestra sólo el nombre, el precio, el tope dibujado
 * y lo que suma, sin botones propios (los caminos al alta están en el inicio
 * y el cierre). Desde 2026-10-09 (Julieta: la carta con puntos guía se veía "muy
 * básica") son tres tarjetas, pero no iguales: el Básico es la destacada
 * (vidrio celeste y borde de tinta) y cada plan DIBUJA su tope de turnos
 * del mes, un cuadradito por turno, para que la diferencia se vea antes de
 * leerla. Pro, sin tope, es una barra llena.
 *
 * El HTML del servidor trae `RESPALDO` (planes.ts); después se pide
 * GET /subscription/plans/public y, si responde bien, gana la API (una sola
 * fuente de verdad). Antes la sección dependía sólo del fetch: con el backend
 * de Render dormido no aparecía, y "/#precios" caía en cualquier lado.
 */

/** El tope del mes, dibujado: un cuadradito por turno (3, 15) o una barra
 *  llena si no hay tope. Al aparecer se van llenando de a uno. */
function Tope({ max, destacado }: { max: number | null; destacado: boolean }) {
  if (max === null) {
    return (
      <div aria-hidden className="anim-bar h-2.5 w-full origin-left rounded-full bg-gradient-to-r from-primary to-secondary-strong" />
    );
  }
  return (
    <div aria-hidden className="flex flex-wrap gap-1">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`anim-fill h-2.5 w-2.5 rounded-[3px] ${destacado ? "bg-primary" : "bg-ink/80"}`}
          style={{ ["--d" as string]: `${300 + i * 70}ms` }}
        />
      ))}
    </div>
  );
}

export default function Precios() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>(RESPALDO);

  useEffect(() => {
    let alive = true;
    api
      .get<{ plans: SubscriptionPlan[] }>("/subscription/plans/public")
      .then((res) => {
        if (alive && Array.isArray(res?.plans) && res.plans.length > 0) setPlans(res.plans);
      })
      .catch(() => {
        // Se queda el respaldo: en la landing no se muestra un error de red.
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section id="precios" aria-labelledby="precios-titulo" data-tone="light" className="landing-sec scroll-mt-[var(--lht)]">
      <h2 id="precios-titulo" className="landing-h2 max-w-[14ch]">
        Empezás gratis, sin comisión por turno
      </h2>

      <Reveal className="mt-[var(--aire)] w-full max-w-[1080px]">
        <ul className="grid gap-4 text-left lg:grid-cols-3 lg:gap-5">
          {plans.map((p) => {
            const destacado = p.code === "basico";
            const gratis = Number(p.price_ars) === 0;
            // El primer beneficio repite el tope que ya está dibujado arriba.
            const extra = p.features.slice(1).join(" · ");
            return (
              <li
                key={p.code}
                className={`flex flex-col rounded-[1.25rem] p-6 ${
                  destacado ? "bg-glow shadow-[var(--shadow-float)] ring-[1.5px] ring-ink" : "bg-card ring-1 ring-line"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-display text-h2 font-semibold text-ink">{p.name}</span>
                  {destacado && (
                    <span className="rounded-full bg-night px-2.5 py-1 font-mono text-label font-medium uppercase tracking-[0.1em] text-white">
                      Recomendado
                    </span>
                  )}
                </div>
                <p className="mt-4 flex items-baseline gap-1.5">
                  <span className="font-display text-[clamp(2.5rem,4vw,3.4rem)] font-semibold leading-none tracking-[-0.045em] tabular-nums text-ink">
                    {gratis ? "$0" : formatArs(p.price_ars)}
                  </span>
                  <span className="text-body text-ink-mute">{gratis ? "para siempre" : "/mes"}</span>
                </p>

                <div className="mt-6">
                  <p className="mb-2 font-mono text-caption font-medium uppercase tracking-[0.1em] text-ink-mute">
                    {p.max_turnos_mes === null ? "Turnos sin tope" : `${p.max_turnos_mes} turnos por mes`}
                  </p>
                  <Tope max={p.max_turnos_mes} destacado={destacado} />
                </div>

                {extra && <p className="mt-5 border-t border-line pt-4 text-body text-ink-soft">{extra}</p>}
              </li>
            );
          })}
        </ul>
      </Reveal>
    </section>
  );
}
