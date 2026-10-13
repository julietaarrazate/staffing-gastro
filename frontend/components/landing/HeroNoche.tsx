"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import RelojDelTurno from "./RelojDelTurno";
import { ToastLine } from "./replicas";

/**
 * La noche del hero, contada como en la historia original (Julieta,
 * 2026-10-13: "estaba mejor la original, donde simula escribiendo el mensaje
 * el mozo, se entendía más"), pero por tiempo y no por scroll:
 *
 * 1. Viernes, salón lleno, 20:46 en grande. Martín está escribiendo
 *    (los tres puntitos, un rato largo: es la espera que pone nervioso).
 * 2. Llega "Perdón, hoy no llego." y la burbuja se sacude.
 * 3. La narración: "Arrancás a las 21. Y te escribe el mozo."
 * 4. El reloj del turno: 20:46 · sin cubrir.
 * 5. La línea baja hasta 20:54 · cubierto; la hora grande pasa a 20:54.
 * 6. Lucía confirma.
 *
 * Lento a propósito, unos 11 s, para que se lea. Arranca cuando la escena se
 * ve casi entera. El HTML del servidor trae el final; el script `landing-js`
 * (app/page.tsx) esconde los pasos antes de pintar para que no titile, y sin
 * JavaScript o con "reducir movimiento" se ve todo quieto.
 */
const FASES = [2900, 4500, 6900, 8300, 9100, 10100] as const; // ms en que entra cada fase 1…6

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
      className="flex w-full max-w-[360px] flex-col items-start gap-5 lg:mx-auto"
    >
      <div>
        <p className="font-mono text-caption uppercase tracking-[0.14em] text-manteca">Viernes · salón lleno</p>
        {/* La hora grande: 20:46 hasta que el turno queda cubierto. */}
        <p className="mt-1 font-display text-poster font-normal tabular-nums tracking-[-0.015em] text-white">
          <span key={f >= 5 ? "54" : "46"} className={cn("inline-block", fase !== null && f === 5 && "landing-tic")}>
            {f >= 5 ? "20:54" : "20:46"}
          </span>
        </p>
      </div>

      <div
        className={cn(
          "w-full rounded-[22px_22px_22px_6px] bg-[var(--burbuja)] px-5 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.35)] transition duration-700 ease-[cubic-bezier(.2,.8,.2,1)]",
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

      <p
        className={cn(
          "hn-paso max-w-[18ch] font-display text-h1 font-medium leading-tight tracking-[-0.012em] text-white [text-wrap:balance] transition duration-700 ease-[cubic-bezier(.2,.8,.2,1)]",
          ver(3)
        )}
      >
        Arrancás a las 21. Y te escribe el mozo.
      </p>

      <RelojDelTurno
        at="sinCubrir"
        className={cn(
          "hn-paso origin-top-left ring-1 ring-white/12 transition duration-700 ease-[cubic-bezier(.2,.8,.2,1)]",
          ver(4)
        )}
      />
      <span
        className={cn(
          "hn-paso -my-2 ml-5 h-6 w-px origin-top border-l-2 border-dotted border-white/30 transition duration-700",
          f >= 5 ? "scale-y-100 opacity-100" : "scale-y-0 opacity-0"
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
