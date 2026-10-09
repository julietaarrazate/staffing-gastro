"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { REGISTRO } from "./fixtures";
import { easeOut } from "./layout";
import { useStory } from "./Stage";

/**
 * RESULTADO. El hueco del principio quedó cubierto. Sobre la superficie de
 * marca (`bg-brand`: verde bosque, o el azul hondo con la paleta celeste),
 * el registro del turno: cada cosa que
 * mostró el reloj, en orden, con su hora. Arranca con Martín cayéndose y
 * pasa por Lucía llegando. No es un ticket de papel a propósito (esa metáfora
 * ya es de otra marca del rubro): es la bitácora, en la misma línea mono del
 * reloj.
 */
export default function Resultado() {
  const ref = useRef<HTMLElement>(null);
  const { enhanced } = useStory();
  // 0,1333 y no 0,35 (2026-10-08): el mismo encendido en 4/3 del recorrido,
  // un 25% más lento.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 0.1333"] });
  // Se encienden las luces: la sección entra en la noche del principio y se
  // aclara hasta el color de marca. Hasta el 2026-10-08 el color subía desde
  // abajo como un telón, y el titular (blanco, arriba de todo) pasaba un buen
  // tramo sobre el lienzo claro, sin leerse; así el texto siempre está sobre
  // oscuro.
  const nightOpacity = useTransform(scrollYProgress, (p: number) => 1 - easeOut(p));

  return (
    <section
      ref={ref}
      id="resultado"
      aria-label="Turno cubierto"
      data-tone="forest"
      data-hide-cta=""
      className="relative overflow-hidden bg-brand"
    >
      {enhanced && <motion.div aria-hidden className="absolute inset-0 bg-night" style={{ opacity: nightOpacity }} />}
      <div className="relative px-4 py-20 sm:px-6 lg:grid lg:grid-cols-12 lg:gap-12 lg:px-12 lg:py-28">
        <div className="lg:col-span-5">
          <p className="font-mono text-label font-medium uppercase tracking-[0.14em] text-white/85">
            Viernes · Tu bar · Palermo
          </p>
          <h2 className="mt-3 font-display text-poster font-medium tracking-[-0.03em] text-white [text-wrap:balance] lg:text-hero">
            Viernes, 21:00. Turno <span className="font-bold">cubierto.</span>
          </h2>
          <p className="mt-4 max-w-[34ch] text-lg text-white/90">
            Martín avisó a las 20:46. A las 20:54, Lucía ya había confirmado.
          </p>
        </div>

        <div className="mt-12 lg:col-span-6 lg:col-start-7 lg:mt-0">
          <ol aria-label="Registro del turno" className="font-mono text-metadata uppercase tracking-[0.1em] text-white lg:text-caption">
            <li className="mb-3 text-white/85">Tu bar · Mozo/a · 21:00–02:00</li>
            {REGISTRO.map((r, i) => (
              <motion.li
                key={`${r.hora}-${r.texto}`}
                className="flex items-baseline gap-3 border-b border-white/10 py-2.5"
                initial={enhanced ? { opacity: 0, y: 4 } : false}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, margin: "0px 0px -20% 0px" }}
                transition={{ duration: 0.4, delay: i * 0.08, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <span className="shrink-0 tabular-nums text-manteca">{r.hora}</span>
                <span aria-hidden className="story-leader" />
                <span className="text-right">{r.texto}</span>
              </motion.li>
            ))}
          </ol>
          <p className="mt-5 font-mono text-label uppercase tracking-[0.12em] text-white/90">
            Martín, Lucía y los horarios son de ejemplo. El objetivo de cubrir un turno en menos de 10 minutos, no.
          </p>
        </div>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-start lg:col-span-12 lg:mt-16">
          <Link
            href="/register?rol=comercio"
            data-cta="resultado"
            className="inline-flex h-[52px] items-center justify-center rounded-[var(--radius-btn)] bg-primary px-7 text-base font-semibold text-night shadow-[var(--shadow-primary)] transition duration-200 active:scale-[0.96] hover:brightness-[1.04]"
          >
            Necesito personal
          </Link>
          <div className="flex flex-col gap-2">
            <Link
              href="/register?rol=trabajador"
              data-cta="resultado-trabajo"
              // Secundario sobre color: transparente con borde blanco. Antes
              // era blanco lleno y pesaba más que el principal. Al 60%, como
              // lo pidió Julieta: sobre el azul hondo liso da 4,07 (el borde
              // de un botón pide 3:1). Con el brillo del degradé violeta que
              // se probó antes daba 2,48 y había quedado en 80%.
              className="inline-flex h-[52px] items-center justify-center rounded-[var(--radius-btn)] px-7 text-base font-semibold text-white ring-[1.5px] ring-white/60 ring-inset transition duration-200 active:scale-[0.96] hover:bg-white/10"
            >
              Quiero trabajar
            </Link>
            <p className="max-w-[30ch] text-body text-white">
              El comercio te paga directo, sin comisión ni intermediarios.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
