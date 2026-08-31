"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll } from "motion/react";
import type { ComponentType } from "react";
import Reveal from "./Reveal";
import { BoltIcon, ClipboardIcon, ShieldIcon, type IconProps } from "@/components/icons";

type Step = {
  Icon: ComponentType<IconProps>;
  title: string;
  text: string;
  /** Tinte del ícono: acompaña el rol del paso, no rota por rotar. */
  accent: string;
};

const STEPS: Step[] = [
  {
    Icon: ClipboardIcon,
    title: "Publicá el turno",
    text: "Cargá la posición, el horario y la paga. Queda visible al instante.",
    accent: "bg-manteca-tint text-manteca-text",
  },
  {
    Icon: BoltIcon,
    title: "Elegí de una lista rankeada",
    text: "Te mostramos candidatos ordenados por cercanía, experiencia y reputación.",
    accent: "bg-cielo-tint text-cielo-text",
  },
  {
    Icon: ShieldIcon,
    title: "Listo, turno cubierto",
    text: "El trabajador confirma, hace check-in con ubicación y coordinan por chat.",
    accent: "bg-white text-primary-text",
  },
];

/**
 * "Cómo funciona" narrativo: los 3 pasos se revelan en secuencia (Reveal) y
 * quedan sobre un riel vertical cuyo relleno naranja se "dibuja" con el
 * progreso del scroll (scaleY atado a scrollYProgress, transform-origin
 * arriba). Con reduced-motion no se dibuja el relleno: queda el riel neutro
 * fijo y los 3 pasos visibles sin animación (fallback estático completo).
 *
 * `.no-select` (regla C0, docs/planning/PULIDO_ROADMAP.md fix 2): título y pasos son
 * chrome de vitrina, no contenido de lectura — se podían seleccionar como
 * texto de página al arrastrar el dedo por la sección.
 */
export default function HowItWorksTimeline() {
  const trackRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start 0.75", "end 0.4"],
  });

  return (
    <section className="no-select mt-20 sm:mt-24">
      <Reveal>
        <h2 className="text-center text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          Cómo funciona
        </h2>
      </Reveal>

      <div ref={trackRef} className="relative mx-auto mt-10 max-w-xl">
        {/* Riel neutro de fondo */}
        <div aria-hidden className="absolute bottom-2 left-6 top-2 w-[3px] rounded-full bg-line" />
        {/* Riel naranja que se dibuja con el scroll */}
        {!reducedMotion && (
          <motion.div
            aria-hidden
            className="absolute bottom-2 left-6 top-2 w-[3px] origin-top rounded-full bg-primary"
            style={{ scaleY: scrollYProgress }}
          />
        )}

        <div className="space-y-10">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.1}>
              <div className="relative flex gap-5">
                <span
                  className={`relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-[var(--shadow-soft)] ring-1 ring-line ${s.accent}`}
                >
                  <s.Icon size={22} />
                </span>
                <div className="pt-1.5">
                  <p className="text-xs font-bold uppercase tracking-wide text-ink/40">
                    Paso {i + 1}
                  </p>
                  <h3 className="mt-1 font-bold text-ink">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-ink/60">{s.text}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
