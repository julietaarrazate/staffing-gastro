"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { REGISTRO } from "./fixtures";
import { easeOut } from "./layout";
import { useStory } from "./Stage";

/**
 * RESULTADO. El hueco del principio quedó cubierto. Sobre el verde bosque (la
 * superficie destacada del sistema), el registro del turno: cada cosa que
 * mostró el reloj, en orden, con su hora. Arranca con Martín cayéndose y
 * pasa por Lucía llegando. No es un ticket de papel a propósito (esa metáfora
 * ya es de otra marca del rubro): es la bitácora, en la misma línea mono del
 * reloj.
 */
export default function Resultado() {
  const ref = useRef<HTMLElement>(null);
  const { enhanced } = useStory();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 0.35"] });
  // Se encienden las luces: el bosque sube desde abajo mientras la sección
  // entra.
  const clipPath = useTransform(scrollYProgress, (p: number) => `inset(${((1 - easeOut(p)) * 100).toFixed(2)}% 0% 0% 0%)`);

  return (
    <section
      ref={ref}
      id="resultado"
      aria-label="Turno cubierto"
      data-tone="forest"
      data-hide-cta=""
      className="relative overflow-hidden bg-paper"
    >
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-secondary"
        style={enhanced ? { clipPath } : undefined}
      />
      <div className="relative px-4 py-20 sm:px-6 lg:grid lg:grid-cols-12 lg:gap-12 lg:px-12 lg:py-28">
        <div className="lg:col-span-5">
          <p className="font-mono text-label font-medium uppercase tracking-[0.14em] text-[#F1E7A0]">
            Viernes · Tu bar · Palermo
          </p>
          <h2 className="mt-4 font-display text-poster font-medium tracking-[-0.03em] text-white [text-wrap:balance] lg:text-hero">
            Viernes, 21:00. Turno <span className="font-bold">cubierto.</span>
          </h2>
          <p className="mt-5 max-w-[34ch] text-lg text-[#F1E7A0]">
            Martín avisó a las 20:46. A las 20:54, Lucía ya había confirmado.
          </p>
        </div>

        <div className="mt-12 lg:col-span-6 lg:col-start-7 lg:mt-0">
          <ol aria-label="Registro del turno" className="font-mono text-metadata uppercase tracking-[0.1em] text-white lg:text-caption">
            <li className="mb-3 text-[#F1E7A0]">Tu bar · Mozo/a · 21:00–02:00</li>
            {REGISTRO.map((r, i) => (
              <motion.li
                key={`${r.hora}-${r.texto}`}
                className="flex items-baseline gap-3 border-b border-white/10 py-2.5"
                initial={enhanced ? { opacity: 0, y: 4 } : false}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, margin: "0px 0px -20% 0px" }}
                transition={{ duration: 0.3, delay: i * 0.06, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <span className="shrink-0 tabular-nums text-[#F1E7A0]">{r.hora}</span>
                <span aria-hidden className="story-leader" />
                <span className="text-right">{r.texto}</span>
              </motion.li>
            ))}
          </ol>
          <p className="mt-5 font-mono text-label uppercase tracking-[0.12em] text-[#F1E7A0]/70">
            Martín, Lucía y los horarios son de ejemplo. El objetivo de cubrir un turno en menos de 10 minutos, no.
          </p>
        </div>

        <div className="mt-14 flex flex-col gap-3 sm:flex-row sm:items-start lg:col-span-12 lg:mt-16">
          <Link
            href="/register?rol=comercio"
            data-cta="resultado"
            className="inline-flex h-[52px] items-center justify-center rounded-[var(--radius-btn)] bg-primary px-7 text-base font-semibold text-night shadow-[var(--shadow-primary)] transition active:scale-[0.96] hover:brightness-[1.04]"
          >
            Necesito personal
          </Link>
          <div className="flex flex-col gap-2">
            <Link
              href="/register?rol=trabajador"
              data-cta="resultado-trabajo"
              className="inline-flex h-[52px] items-center justify-center rounded-[var(--radius-btn)] bg-white px-7 text-base font-semibold text-ink transition active:scale-[0.96]"
            >
              Quiero trabajar
            </Link>
            <p className="max-w-[30ch] text-body text-[#F1E7A0]">
              El comercio te paga directo, sin comisión ni intermediarios.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
