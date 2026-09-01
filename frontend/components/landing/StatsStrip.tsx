"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "motion/react";
import { WORKER_SKILLS } from "@/lib/types";

type Stat = { value: number; suffix?: string; label: string };

// Valores honestos: nada de tracción inventada (todavía no hay beta abierta,
// ver docs/planning/LAUNCH_PLAN.md — beta cerrada arrancando en Palermo). Los 2
// números son hechos verificables del producto hoy, no métricas de uso:
// - cantidad real de puestos que cubre el matching (WORKER_SKILLS)
// - la meta de producto (misión "cubrir un turno en <10 min", no un
//   promedio medido — por eso el label dice "objetivo", no "promedio").
const STATS: Stat[] = [
  { value: WORKER_SKILLS.length, label: "Puestos gastronómicos que cubrimos" },
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
 * `.no-select` (regla C0, docs/planning/PULIDO_ROADMAP.md fix 2): es chrome de
 * vitrina — un visitante no necesita seleccionar un número como si fuera texto
 * de un artículo, y antes se marcaba como cualquier página web al arrastrar
 * el dedo sobre la franja.
 */
export default function StatsStrip() {
  return (
    <section className="no-select mt-20 sm:mt-24">
      <div className="grid grid-cols-1 gap-8 rounded-[var(--radius-card)] bg-card p-8 shadow-[var(--shadow-soft)] ring-1 ring-line sm:grid-cols-2 sm:gap-6 sm:p-10">
        {STATS.map((s, i) => (
          <div key={s.label} className="text-center">
            {/* El segundo dato va en cielo-text, no en naranja: son dos hechos
                distintos (cobertura y velocidad) y pintarlos iguales los hacía
                leer como uno solo. El naranja queda para el primero. */}
            <p
              className={`text-4xl font-extrabold tracking-tight tabular-nums sm:text-5xl ${
                i === 0 ? "text-primary-text" : "text-cielo-text"
              }`}
            >
              <Counter value={s.value} suffix={s.suffix} />
            </p>
            <p className="mx-auto mt-2 max-w-[22ch] text-sm font-medium text-ink/60">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
