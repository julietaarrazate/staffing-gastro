"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import { RELOJ, type RelojKey } from "./fixtures";
import { useReloj } from "./relojStore";

/**
 * El reloj del turno: la firma de la landing. Una línea en mono, siempre en el
 * mismo lugar (arriba a la izquierda de cada escena), con la hora, el puesto,
 * el barrio y el estado del turno.
 *
 * - Sólo cambia la última palabra, y se reescribe letra por letra, cuando pasa
 *   algo de verdad (se publica, alguien se postula, Lucía confirma).
 * - La hora avanza un minuto sólo cuando alguien actúa.
 * - Mientras el turno está sin cubrir, los dos puntos de la hora laten; cuando
 *   se cubre, la píldora pasa al color de marca (`secondary`: verde bosque, o
 *   violeta con la paleta nueva) y la hora se queda quieta. Así se
 *   siente el objetivo de los 10 minutos sin afirmarlo como dato.
 */
export default function RelojDelTurno({
  at,
  className,
  surface = "light",
}: {
  at: RelojKey;
  className?: string;
  /** Sobre qué fondo está dibujado: cambia sólo el borde (la píldora es
   *  siempre oscura, para leerse igual sobre lienzo, ámbar o noche). */
  surface?: "light" | "dark";
}) {
  const { hora, estado } = RELOJ[at];
  const covered = at === "cubierto" || at === "enCamino" || at === "llego";
  const shown = useRetype(estado.toUpperCase());
  const [hh, mm] = hora.split(":");

  return (
    <div
      className={cn(
        "inline-flex max-w-full items-center gap-2 whitespace-nowrap rounded-full py-1.5 pl-2.5 pr-3.5 font-mono text-label font-medium uppercase tracking-[0.14em] shadow-[var(--shadow-soft)] transition-colors duration-667",
        covered ? "bg-secondary text-white" : "bg-night text-white",
        surface === "dark" && "ring-1 ring-white/12",
        className
      )}
      // Un lector de pantalla lee el estado completo de una vez, no letra por
      // letra mientras se reescribe.
      aria-label={`${hora}, mozo, Palermo, ${estado}`}
      role="status"
    >
      <span
        aria-hidden
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          covered ? "bg-manteca" : at === "sinCubrir" || at === "pidiendo" ? "bg-danger" : "bg-manteca"
        )}
      />
      <span aria-hidden className="tabular-nums">
        {hh}
        <span className={covered ? undefined : "story-colon"}>:</span>
        {mm}
      </span>
      <span aria-hidden className="text-white/45">·</span>
      <span aria-hidden className="max-sm:hidden">Mozo · Palermo</span>
      <span aria-hidden className="text-white/45 max-sm:hidden">·</span>
      <span aria-hidden className="sm:hidden">Mozo</span>
      <span aria-hidden className="text-white/45 sm:hidden">·</span>
      <span aria-hidden className="text-manteca">{shown}</span>
    </div>
  );
}

/** Fondo y tinta de la franja del reloj según el tramo que tiene debajo
 *  (los mismos del encabezado, del que cuelga). */
const STRIP: Record<"light" | "paper" | "night" | "amber" | "forest", { bg: string; label: string }> = {
  light: { bg: "bg-background/95 border-line", label: "text-ink-mute" },
  paper: { bg: "bg-paper border-transparent", label: "text-ink-mute" },
  night: { bg: "bg-night border-transparent", label: "text-manteca/70" },
  amber: { bg: "bg-primary border-transparent", label: "text-ink/70" },
  // Sobre el violeta, manteca al 70% daría 3.28: blanco al 75% (5.19).
  forest: { bg: "bg-secondary border-transparent", label: "text-white/75" },
};

/**
 * La franja del reloj de la versión animada: cuelga del encabezado mientras
 * dura la historia, así el reloj es uno solo, siempre en el mismo lugar, y lo
 * que se scrollea pasa por debajo en vez de chocar con él. Lo que muestra lo
 * deciden los actos (`setReloj`). Va superpuesta (absoluta) para no empujar la
 * página cuando aparece.
 */
export function RelojFijo({ tone }: { tone: keyof typeof STRIP }) {
  const at = useReloj();
  const t = STRIP[tone];
  return (
    <AnimatePresence>
      {at && (
        <motion.div
          key="franja"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2933, ease: [0.2, 0.8, 0.2, 1] }}
          className={cn(
            "pointer-events-none absolute inset-x-0 top-full border-b transition-colors duration-400",
            t.bg
          )}
        >
          <div className="flex h-10 items-center justify-between gap-3 px-4 sm:px-6 lg:px-12">
            <RelojDelTurno at={at} surface={tone === "night" || tone === "forest" ? "dark" : "light"} />
            <span
              className={cn(
                "hidden whitespace-nowrap font-mono text-label font-medium uppercase tracking-[0.14em] min-[400px]:inline",
                t.label
              )}
            >
              Historia ilustrativa
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Reescribe el texto letra por letra cuando cambia (24 ms por letra, tope de
 *  400 ms). Con reducir movimiento, el cambio es directo. */
function useRetype(target: string): string {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(target);
  const prev = useRef(target);

  useEffect(() => {
    if (prev.current === target) return;
    prev.current = target;
    if (reduced) {
      setShown(target);
      return;
    }
    const step = Math.max(13.33, Math.min(24, 400 / Math.max(1, target.length)));
    let i = 0;
    setShown("");
    const id = setInterval(() => {
      i += 1;
      setShown(target.slice(0, i));
      if (i >= target.length) clearInterval(id);
    }, step);
    return () => clearInterval(id);
  }, [target, reduced]);

  return shown;
}
