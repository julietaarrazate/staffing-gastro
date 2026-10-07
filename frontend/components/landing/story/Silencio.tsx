"use client";

import RelojDelTurno from "./RelojDelTurno";
import { useStory } from "./Stage";

/**
 * SILENCIO. Después del primer pico, nada se mueve: una pregunta sobre el
 * lienzo vacío y el reloj quieto arriba (en la versión animada es el reloj
 * fijo; en la estática, una copia en el mismo lugar). Que nada pase es el
 * diseño: el primer movimiento de la escena siguiente se lee como respuesta.
 */
export default function Silencio() {
  const { enhanced } = useStory();
  return (
    <section
      aria-label="Y ahora"
      data-tone="light"
      data-hide-cta=""
      className="relative flex min-h-[60svh] flex-col px-4 pb-16 pt-[4.5rem] sm:px-6 lg:min-h-[70svh] lg:px-12 lg:pt-24"
    >
      {!enhanced && <RelojDelTurno at="sinCubrir" className="absolute left-4 top-3 sm:left-6 lg:left-12" />}
      <h2 className="max-w-[12ch] font-display text-poster font-medium tracking-[-0.03em] text-ink [text-wrap:balance] lg:max-w-[14ch] lg:text-hero">
        ¿Y ahora a quién <span className="font-bold">llamás?</span>
      </h2>
    </section>
  );
}
