"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatArs } from "@/lib/format";
import { CheckIcon } from "@/components/icons";
import type { SubscriptionPlan } from "@/lib/types";
import { RESPALDO } from "./planes";
import Reveal from "./Reveal";

/**
 * PRECIOS. Responde "¿cuánto sale?" una vez que se entendió qué hace. Desde 2026-10-09 (Julieta: la carta con puntos guía se veía "muy
 * básica") son tres tarjetas, pero no iguales: el Básico es la destacada
 * (vidrio celeste, el único botón ámbar) y cada plan DIBUJA su tope de turnos
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
    <section
      id="precios"
      aria-labelledby="precios-titulo"
      data-tone="light"
      className="scroll-mt-[var(--lht)] px-4 py-14 sm:px-6 lg:px-12 lg:py-20"
    >
      <div className="lg:flex lg:items-end lg:justify-between lg:gap-12">
        <div>
          <p className="font-mono text-caption font-medium uppercase tracking-[0.12em] text-ink-mute">Precios para comercios</p>
          <h2
            id="precios-titulo"
            className="mt-3 font-display text-poster font-semibold tracking-[-0.015em] text-ink [text-wrap:balance]"
          >
            Empezás gratis, sin comisión por turno
          </h2>
        </div>
      </div>

      <Reveal>
        <ul className="mt-10 grid gap-4 lg:mt-14 lg:grid-cols-3 lg:items-stretch lg:gap-5">
          {plans.map((p) => {
            const destacado = p.code === "basico";
            const gratis = Number(p.price_ars) === 0;
            return (
              <li
                key={p.code}
                className={`relative flex flex-col rounded-[var(--radius-card)] p-6 ${
                  destacado
                    ? "bg-glow shadow-[var(--shadow-float)] ring-1 ring-secondary-strong lg:-my-3 lg:py-9"
                    : "bg-card ring-1 ring-line"
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
                <p className="mt-4 flex items-baseline gap-1">
                  <span className="font-display text-poster font-semibold tracking-[-0.015em] tabular-nums text-ink">
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

                <ul className="mt-6 space-y-2.5 border-t border-line pt-5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-body text-ink-soft">
                      <CheckIcon size={16} className="mt-0.5 shrink-0 text-secondary-text" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>

                <div aria-hidden className="min-h-7 flex-1" />
                <Link
                  href="/register?rol=comercio"
                  data-cta={`precios-${p.code}`}
                  className={`inline-flex h-[52px] items-center justify-center rounded-[var(--radius-btn)] px-6 text-base font-semibold transition duration-200 active:scale-[0.96] ${
                    destacado
                      ? "bg-primary text-night shadow-[var(--shadow-primary)] hover:brightness-[1.04]"
                      : "bg-card text-ink ring-1 ring-ink/15 hover:ring-ink/30"
                  }`}
                >
                  {gratis ? "Publicar un turno gratis" : `Elegir ${p.name}`}
                </Link>
              </li>
            );
          })}
        </ul>
      </Reveal>

    </section>
  );
}
