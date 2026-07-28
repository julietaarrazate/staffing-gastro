"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "motion/react";
import { WORKER_SKILLS } from "@/lib/types";

type Stat = { value: number; suffix?: string; label: string };

// Valores honestos: nada de tracción inventada (todavía no hay beta abierta,
// ver docs/LAUNCH_PLAN.md — beta cerrada arrancando en Palermo). Los 3
// números son hechos verificables del producto hoy, no métricas de uso:
// - cantidad real de puestos que cubre el matching (WORKER_SKILLS)
// - radio real del algoritmo de ranking (docs/MATCHING.md: máx. 25 km)
// - la meta de producto (misión "cubrir un turno en <10 min", no un
//   promedio medido — por eso el label dice "objetivo", no "promedio").
const STATS: Stat[] = [
  { value: WORKER_SKILLS.length, label: "Puestos gastronómicos que cubrimos" },
  // El ranking ordena por cercanía: el #1 siempre es de los más cercanos.
  // Antes este número se mostraba como "radio de búsqueda: 25 km", que vende
  // justo lo contrario de la promesa — nadie quiere cubrir un turno urgente
  // con alguien a 25 km. El dato honesto no es el techo del algoritmo, sino
  // que el orden es por proximidad.
  { value: 1, suffix: "º", label: "Primero, siempre el candidato más cercano" },
  { value: 10, suffix: " min", label: "Objetivo: tiempo hasta el primer candidato" },
];

/** Cuenta de 0 al valor final cuando entra al viewport (una sola vez). */
function Counter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const reducedMotion = useReducedMotion();
  const [display, setDisplay] = useState(reducedMotion ? value : 0);

  useEffect(() => {
    // Con reduced-motion el valor ya arrancó en `value` (useState inicial):
    // no hay nada que animar ni que sincronizar acá.
    if (!inView || reducedMotion) return;
    let raf = 0;
    const duration = 1100;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setDisplay(Math.round(value * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reducedMotion, value]);

  return (
    <span ref={ref}>
      {display.toLocaleString("es-AR")}
      {suffix}
    </span>
  );
}

/**
 * Franja de stats con vida: los números cuentan al entrar al viewport.
 *
 * `.no-select` (regla C0, docs/PULIDO_ROADMAP.md fix 2): es chrome de
 * vitrina — un visitante no necesita seleccionar "25 km" como si fuera texto
 * de un artículo, y antes se marcaba como cualquier página web al arrastrar
 * el dedo sobre la franja.
 */
export default function StatsStrip() {
  return (
    <section className="no-select mt-20 sm:mt-24">
      <div className="grid grid-cols-1 gap-8 rounded-[var(--radius-card)] bg-white p-8 shadow-[var(--shadow-soft)] ring-1 ring-line sm:grid-cols-3 sm:gap-6 sm:p-10">
        {STATS.map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-4xl font-extrabold tracking-tight text-primary tabular-nums sm:text-5xl">
              <Counter value={s.value} suffix={s.suffix} />
            </p>
            <p className="mx-auto mt-2 max-w-[22ch] text-sm font-medium text-ink/60">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
