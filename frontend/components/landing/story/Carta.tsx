"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatArs } from "@/lib/format";
import type { SubscriptionPlan } from "@/lib/types";

/**
 * PRECIOS, como una carta: nombre, puntos guía y precio, sin tres tarjetas
 * iguales. Responde "¿cuánto sale?" después de la historia, cuando ya hay
 * ganas.
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

/** La línea de detalle de cada plan: el tope de turnos y, en Pro, lo único
 *  que cambia en lo que ve la gente (el destacado). El soporte no entra:
 *  no es lo que decide. */
function detalle(p: SubscriptionPlan): string {
  const tope = p.features[0] ?? "";
  return p.features.includes("Destacado en el feed") ? `${tope} · Destacado en el feed` : tope;
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
      className="scroll-mt-[var(--lht)] px-4 py-20 sm:px-6 lg:grid lg:grid-cols-12 lg:gap-12 lg:px-12 lg:py-28"
    >
      <div className="lg:col-span-5">
        <p className="font-mono text-label font-medium uppercase tracking-[0.14em] text-ink-mute">Precios · Para comercios</p>
        <h2 className="mt-3 font-display text-poster font-semibold tracking-[-0.03em] text-ink [text-wrap:balance]">
          Sin comisión por turno.
        </h2>
        <p className="mt-4 max-w-[34ch] text-lg text-ink-soft">
          Empezás gratis y cambiás de plan según cuántos turnos publicás por mes.
        </p>
      </div>

      <div className="mt-10 lg:col-span-6 lg:col-start-7 lg:mt-0">
        <ul className="border-t border-line">
          {plans.map((p) => (
            <li key={p.code} className="border-b border-line py-5">
              <div className="flex items-baseline gap-3">
                <span className="shrink-0 font-display text-h2 font-semibold text-ink">{p.name}</span>
                <span aria-hidden className="story-leader text-ink" />
                <span className="shrink-0 text-right">
                  <span className="text-metric font-extrabold tabular-nums text-ink">{formatArs(p.price_ars)}</span>
                  {Number(p.price_ars) > 0 && <span className="text-caption text-ink-mute">/mes</span>}
                </span>
              </div>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-body text-ink-soft">
                {p.code === "basico" && (
                  <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-label font-medium uppercase tracking-[0.1em] text-on-brand">
                    Recomendado
                  </span>
                )}
                {detalle(p)}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <Link
            href="/register?rol=comercio"
            data-cta="precios"
            className="inline-flex h-[52px] items-center justify-center rounded-[var(--radius-btn)] bg-primary px-7 text-base font-semibold text-night shadow-[var(--shadow-primary)] transition duration-200 active:scale-[0.96] hover:brightness-[1.04]"
          >
            Creá tu comercio gratis
          </Link>
          <p className="text-body text-ink-soft">
            Para trabajar no se paga nada.{" "}
            <Link
              href="/register?rol=trabajador"
              data-cta="precios-trabajo"
              className="font-semibold text-ink underline decoration-accent decoration-2 underline-offset-4 transition-colors duration-200 hover:decoration-secondary"
            >
              Quiero trabajar →
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
