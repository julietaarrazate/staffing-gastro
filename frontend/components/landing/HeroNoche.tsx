"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import RelojDelTurno from "./RelojDelTurno";
import { ToastLine } from "./replicas";

/**
 * La ventana a la noche del hero, animada como en la historia original
 * (Julieta, 2026-10-13: "la parte de Perdón, hoy no llego quedaba bien como
 * estaba"), pero por tiempo y no por scroll:
 *
 * 1. Martín está escribiendo (los tres puntitos).
 * 2. Llega "Perdón, hoy no llego." y la burbuja se sacude.
 * 3. El mensaje se condensa en el reloj del turno: 20:46 · sin cubrir.
 * 4. La línea baja hasta 20:54 · cubierto y Lucía confirma.
 *
 * Lento a propósito, unos 8 s en total, para que se lea. El HTML del servidor
 * trae el final; el script `landing-js` (app/page.tsx) esconde los pasos antes
 * de pintar para que no titile, y sin JavaScript o con "reducir movimiento"
 * se ve todo quieto.
 */
const FASES = [600, 2700, 4700, 5900, 6600, 7400] as const; // ms en que entra cada fase 1…6

export default function HeroNoche() {
  const [fase, setFase] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setFase(6);
      return;
    }
    setFase(0);
    // Arranca cuando la escena se ve casi entera: en el celular queda debajo
    // del inicio y, si arrancaba al cargar, se veía por la mitad o ya
    // terminada (Julieta, 2026-10-13).
    let timers: ReturnType<typeof setTimeout>[] = [];
    const arrancar = () => {
      if (timers.length) return;
      timers = FASES.map((ms, i) => setTimeout(() => setFase(i + 1), ms));
    };
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      arrancar();
      return () => timers.forEach(clearTimeout);
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          arrancar();
          io.disconnect();
        }
      },
      { threshold: 0.75 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach(clearTimeout);
    };
  }, []);

  // Antes de montar (servidor): el final. `data-fase` sólo aparece montado.
  const f = fase ?? 6;
  const ver = (desde: number) => (f >= desde ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-3 scale-95");

  return (
    <div
      ref={ref}
      data-hero-noche=""
      data-fase={fase ?? undefined}
      aria-hidden
      className="flex w-full max-w-[340px] flex-col items-start gap-5 lg:mx-auto"
    >
      <p className="font-mono text-caption uppercase tracking-[0.12em] text-manteca">Viernes · 20:46</p>

      <div
        className={cn(
          "hn-paso w-full rounded-[22px_22px_22px_6px] bg-[var(--burbuja)] px-5 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.35)] transition duration-700 ease-[cubic-bezier(.2,.8,.2,1)]",
          ver(1),
          f === 2 && "landing-sacudida"
        )}
      >
        <p className="font-mono text-caption uppercase tracking-[0.12em] text-[var(--burbuja-tinta)]">Martín · mozo</p>
        {f < 2 ? (
          <p className="story-typing mt-2 flex h-[30px] items-center gap-1.5" aria-label="escribiendo">
            <span className="h-2 w-2 rounded-full bg-white/80" />
            <span className="h-2 w-2 rounded-full bg-white/80" />
            <span className="h-2 w-2 rounded-full bg-white/80" />
          </p>
        ) : (
          <p className="mt-1.5 text-2xl leading-tight text-white">Perdón, hoy no llego.</p>
        )}
        <p className="mt-1 text-right font-mono text-metadata tracking-[0.05em] text-[var(--burbuja-tenue)]">20:46</p>
      </div>

      {/* El mensaje se condensa en el reloj: sale chico desde la burbuja. */}
      <RelojDelTurno
        at="sinCubrir"
        className={cn(
          "hn-paso origin-top-left ring-1 ring-white/12 transition duration-700 ease-[cubic-bezier(.2,.8,.2,1)]",
          f >= 3 ? "opacity-100 translate-y-0 scale-100" : "-translate-y-6 scale-50 opacity-0"
        )}
      />
      <span
        className={cn(
          "hn-paso ml-5 h-8 w-px origin-top border-l-2 border-dotted border-white/30 transition duration-700",
          f >= 4 ? "scale-y-100 opacity-100" : "scale-y-0 opacity-0"
        )}
      />
      <RelojDelTurno
        at="cubierto"
        className={cn("hn-paso transition duration-700 ease-[cubic-bezier(.2,.8,.2,1)]", ver(5))}
      />
      <ToastLine className={cn("hn-paso transition duration-700 ease-[cubic-bezier(.2,.8,.2,1)]", ver(6))}>
        Lucía confirmó tu turno de las 21
      </ToastLine>
    </div>
  );
}
