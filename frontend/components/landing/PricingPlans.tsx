"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { SubscriptionPlan } from "@/lib/types";
import { formatArs } from "@/lib/format";
import { CheckIcon } from "@/components/icons";
import Reveal from "@/components/landing/Reveal";

/**
 * Sección de precios de la landing (feedback de Julieta 2026-08-06: "no queda
 * claro qué costo tiene la plataforma en la versión sin cuenta"). Muestra el
 * catálogo real de planes desde el endpoint público `GET
 * /subscription/plans/public` (una sola fuente de verdad: `plans.py` del
 * backend), sin pedir sesión. Si el fetch falla, la sección simplemente no se
 * renderiza — es marketing, no queremos un cartel de error en la home.
 *
 * El plan del medio (`basico`) se marca como recomendado, mismo criterio que
 * la pantalla "Mi plan" del comercio.
 */
export default function PricingPlans() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ plans: SubscriptionPlan[] }>("/subscription/plans/public");
      setPlans(res.plans);
    } catch {
      // Silencioso a propósito: en la landing preferimos ocultar la sección
      // antes que mostrar un error de red al visitante.
      setPlans([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (plans.length === 0) return null;

  return (
    <section className="no-select mt-20">
      <Reveal>
        <h2 className="text-center font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Precios claros para tu comercio
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-ink/60">
          Pagás una mensualidad simple según cuántos turnos publicás.{" "}
          <strong className="text-ink/80">Sin comisión por turno</strong> y con un
          plan gratis para arrancar.
        </p>
      </Reveal>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {plans.map((plan, i) => {
          const recommended = plan.code === "basico";
          const priceNumber =
            typeof plan.price_ars === "string" ? Number(plan.price_ars) : plan.price_ars;
          return (
            <Reveal key={plan.code} delay={i * 0.06}>
              <div
                className={`flex h-full flex-col rounded-[var(--radius-card)] bg-card p-6 shadow-[var(--shadow-soft)] transition ${
                  recommended ? "ring-2 ring-primary" : "ring-1 ring-line"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-ink">{plan.name}</h3>
                  {recommended && (
                    <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-bold text-primary-text">
                      Recomendado
                    </span>
                  )}
                </div>
                <p className="mt-3">
                  <span className="font-display text-3xl font-semibold text-ink">
                    {priceNumber === 0 ? "Gratis" : formatArs(priceNumber)}
                  </span>
                  {priceNumber > 0 && (
                    <span className="text-sm font-medium text-ink/50"> /mes</span>
                  )}
                </p>
                <ul className="mt-4 flex flex-1 flex-col gap-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-ink/70">
                      <CheckIcon size={16} className="mt-0.5 shrink-0 text-primary-text" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          );
        })}
      </div>

      <Reveal delay={0.1}>
        <p className="mt-6 text-center text-sm text-ink/50">
          <Link href="/register?rol=comercio" className="font-semibold text-primary-text underline">
            Creá tu comercio gratis
          </Link>{" "}
          y publicá tu primer turno hoy.
        </p>
      </Reveal>
    </section>
  );
}
