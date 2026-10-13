"use client";

import Link from "next/link";
import HeroNoche from "./HeroNoche";
import { ActoNoche } from "./story/ActoNoche";
import { useEnhanced } from "./story/useStage";

export const HERO_CTA_ID = "hero-ctas";

/**
 * Primera pantalla: el dolor en la pregunta, la promesa en la respuesta y una
 * línea con qué es Oído; abajo, los dos caminos. Alineado a la izquierda
 * (Julieta, 2026-10-13: "quedaba mejor a la izquierda que centrado").
 *
 * La noche es la de la historia original, atada al scroll (Julieta,
 * 2026-10-13: "estaba mejor con el scroll, el original sigue teniendo mejor
 * efecto"): la noche crece desde su ventana y tapa la página, Martín termina
 * de escribir "Perdón, hoy no llego.", "Arrancás a las 21. Y te escribe el
 * mozo." y la noche se cierra en la burbuja, que queda como el ticket
 * "20:46 · sin cubrir": el puente a "Así se cubre un turno". Es la misma
 * pieza que /historia (`story/ActoNoche`), con este texto y ese final.
 *
 * Sin JavaScript o con "reducir movimiento" va la versión quieta: el texto y,
 * abajo (al costado en escritorio), la noche ya resuelta (HeroNoche).
 */
function HeroTexto() {
  return (
    <div>
      <h1
        id="hero-titulo"
        className="font-display text-[clamp(2.5rem,10vw,4.75rem)] font-semibold leading-[0.98] tracking-[-0.015em] text-ink [text-wrap:balance]"
      >
        <span className="font-medium text-ink-soft">¿Faltó alguien de tu equipo?</span>{" "}
        <span className="block">Conseguí un reemplazo en minutos</span>
      </h1>
      {/* Qué es Oído en una línea: a quién te consigue y dónde. No repite
          el título, suma lo que el título no dice. */}
      <p className="mt-5 max-w-[32ch] text-lg leading-snug text-ink-soft [text-wrap:balance] lg:text-xl">
        Mozos, bartenders y cocina con identidad verificada, cerca de tu local.
      </p>
      {/* Los dos botones del mismo ancho en el celular: lado a lado si
          entran, uno abajo del otro en pantallas angostas. */}
      <div
        id={HERO_CTA_ID}
        className="mt-8 grid w-full max-w-[22rem] grid-cols-1 gap-3 min-[400px]:max-w-[26rem] min-[400px]:grid-cols-2 lg:flex lg:w-auto"
      >
        <Link
          href="/register?rol=comercio"
          data-cta="hero"
          className="inline-flex h-12 items-center justify-center whitespace-nowrap rounded-[var(--radius-btn)] bg-primary px-4 text-base font-semibold text-night shadow-[var(--shadow-primary)] transition duration-200 active:scale-[0.96] hover:brightness-[1.04] lg:h-14 lg:px-8 lg:text-lg"
        >
          Necesito personal
        </Link>
        <Link
          href="/register?rol=trabajador"
          data-cta="hero-trabajo"
          className="inline-flex h-12 items-center justify-center whitespace-nowrap rounded-[var(--radius-btn)] px-4 text-base font-semibold text-ink ring-[1.5px] ring-ink/70 ring-inset transition-colors duration-200 hover:bg-surface active:scale-[0.96] lg:h-14 lg:px-8 lg:text-lg"
        >
          Quiero trabajar
        </Link>
      </div>
    </div>
  );
}

export default function Hero() {
  const enhanced = useEnhanced();
  if (enhanced) return <ActoNoche copy={<HeroTexto />} final="ticket" />;
  return (
    <section
      aria-labelledby="hero-titulo"
      data-tone="light"
      className="lg:grid lg:min-h-[calc(100svh-var(--lht))] lg:grid-cols-12"
    >
      <div
        style={{ background: "var(--wash) no-repeat, var(--background)" }}
        className="px-4 pb-10 pt-8 sm:px-6 lg:col-span-7 lg:flex lg:flex-col lg:justify-center lg:px-12 lg:py-16"
      >
        <HeroTexto />
      </div>
      <div
        data-tone="night"
        aria-label="Ejemplo: un viernes a las 20:46 Martín, el mozo, avisa que no llega. A las 20:54 Lucía confirmó y el turno está cubierto."
        role="img"
        className="flex flex-col items-start justify-center gap-5 bg-night px-4 py-10 sm:px-6 lg:col-span-5 lg:px-10"
      >
        <HeroNoche />
      </div>
    </section>
  );
}
