"use client";

import { useId } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";

/**
 * Control segmentado estilo iOS: una pista con una pastilla blanca que se
 * desliza al segmento activo (motion layout). Reemplaza los chip-tabs.
 *
 * La pista lleva `ring-1 ring-line` (reporte real de Julieta con captura
 * marcada, tabs de `/shifts`: "sigue todo muy beige") — Arena sola, sin
 * borde, casi no se distingue del fondo crema del panel alrededor. El
 * texto inactivo sube de `ink/45` a `ink/60`: sobre Arena, /45 quedaba por
 * debajo de lo legible.
 */
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  // `count`: cuántos hay, como numerito aparte (más angosto que «(3)» pegado
  // al texto: tres pestañas con cantidad entran en 360 px sin scroll).
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex gap-0.5 sm:gap-1 rounded-full bg-surface p-1 ring-1 ring-line", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            aria-label={o.count ? `${o.label} (${o.count})` : undefined}
            onClick={() => onChange(o.value)}
            // `whitespace-nowrap`: sin esto una etiqueta larga
            // ("Postulaciones (1)" en /my-shifts) envuelve a dos líneas y,
            // como el track es flex, ESTIRA a todos los segmentos — la pista
            // entera queda más alta que las demás de la app (Julieta,
            // captura 2026-08-17: "donde dice postulaciones tiene una altura
            // diferente"). Con nowrap todos miden una línea; si la suma no
            // entra, el contenedor de la página ya scrollea en horizontal
            // (ver `overflow-x-auto` en my-shifts/shifts).
            // Debajo de `sm`, 13 px y menos relleno (como el control de iOS):
            // con 14 px las tres pestañas de Matches entraban en 360 px con
            // la fuente local y se pasaban 4 px con la de CI (#609).
            className="relative flex-1 whitespace-nowrap rounded-full px-1.5 py-2 sm:px-3 text-[13px] sm:text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
                className="absolute inset-0 rounded-full bg-raised shadow-[var(--shadow-soft)]"
              />
            )}
            <span className={cn("relative z-10 transition-colors", active ? "text-ink" : "text-ink/60")}>
              {o.label}
              {o.count ? (
                <span className="ml-1 text-xs font-bold tabular-nums opacity-80">{o.count}</span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
