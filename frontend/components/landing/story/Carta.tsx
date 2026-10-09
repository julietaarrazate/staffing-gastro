"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatArs } from "@/lib/format";
import { CheckIcon } from "@/components/icons";
import type { SubscriptionPlan } from "@/lib/types";

/**
 * PRECIOS. Responde "¿cuánto sale?" después de la historia, cuando ya hay
 * ganas. Desde 2026-10-09 (Julieta: la carta con puntos guía se veía "muy
 * básica") son tres tarjetas, pero no iguales: el Básico es la destacada
 * (vidrio celeste, el único botón ámbar) y cada plan DIBUJA su tope de turnos
 * del mes, un cuadradito por turno, para que la diferencia se vea antes de
 * leerla. Pro, sin tope, es una barra llena.
 *
 * El HTML del servidor trae `RESPALDO`, copia literal de
 * backend/app/modules/subscription/domain/plans.py; después se pide
 * GET /subscription/plans/public y, si responde bien, gana la API (una sola
 * fuente de verdad). Antes la sección dependía sólo del fetch: con el backend
 * de Render dormido no aparecía, y "/#precios" caía en cualquier lado.
 */
const RESPALDO: SubscriptionPlan[] = [
  { code: "gratis", name: "Gratis", price_ars: 0, max_turnos_mes: 3, features: ["Hasta 3 turnos publicados por mes", "Soporte por email"] },
  { code: "basico", name: "Básico", price_ars: 20000, max_turnos_mes: 15, features: ["Hasta 15 turnos publicados por mes", "Soporte prioritario"] },
  {
    code: "pro",
    name: "Pro",
    price_ars: 45000,
    max_turnos_mes: null,
    features: ["Turnos publicados ilimitados", "Soporte prioritario", "Destacado en el feed"],
  },
];

/** El tope del mes, dibujado: un cuadradito por turno (3, 15) o una barra
 *  llena si no hay tope. */
function Tope({ max, destacado }: { max: number | null; destacado: boolean }) {
  if (max === null) {
    return (
      <div aria-hidden className="h-2.5 w-full rounded-full bg-gradient-to-r from-primary to-secondary-strong" />
    );
  }
  return (
    <div aria-hidden className="flex flex-wrap gap-1">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`h-2.5 w-2.5 rounded-[3px] ${destacado ? "bg-primary" : "bg-ink/80"}`} />
      ))}
    </div>
  );
}

export default function Carta() {
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
      aria-label="Precios"
      data-tone="light"
      data-hide-cta=""
      className="scroll-mt-[var(--lht)] px-4 py-20 sm:px-6 lg:px-12 lg:py-28"
    >
      <div className="lg:flex lg:items-end lg:justify-between lg:gap-12">
        <div>
          <p className="font-mono text-label font-medium uppercase tracking-[0.14em] text-ink-mute">Precios · Para comercios</p>
          <h2 className="mt-3 font-display text-poster font-semibold tracking-[-0.03em] text-ink [text-wrap:balance]">
            Sin comisión por turno.
          </h2>
        </div>
        <p className="mt-4 max-w-[34ch] text-lg text-ink-soft lg:mt-0">
          Empezás gratis y cambiás de plan según cuántos turnos publicás por mes.
        </p>
      </div>

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
                <span className="font-display text-poster font-semibold tracking-[-0.03em] tabular-nums text-ink">
                  {gratis ? "$0" : formatArs(p.price_ars)}
                </span>
                <span className="text-body text-ink-mute">{gratis ? "para siempre" : "/mes"}</span>
              </p>

              <div className="mt-6">
                <p className="mb-2 font-mono text-label font-medium uppercase tracking-[0.12em] text-ink-mute">
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
                {gratis ? "Creá tu comercio gratis" : `Elegir ${p.name}`}
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="mt-8 text-center text-body text-ink-soft">
        Para trabajar no se paga nada.{" "}
        <Link
          href="/register?rol=trabajador"
          data-cta="precios-trabajo"
          className="font-semibold text-ink underline decoration-accent decoration-2 underline-offset-4 transition-colors duration-200 hover:decoration-secondary"
        >
          Quiero trabajar →
        </Link>
      </p>
    </section>
  );
}
