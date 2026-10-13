import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { RELOJ, type RelojKey } from "./fixtures";

/**
 * El reloj del turno: una píldora en mono con la hora, el puesto y el estado.
 * Sin cubrir, la píldora es noche y los dos puntos de la hora laten; cubierto,
 * pasa al color de marca y la hora se queda quieta. Dos píldoras (20:46 y
 * 20:54) cuentan los minutos sin afirmar un promedio.
 */
export default function RelojDelTurno({
  at,
  className,
  style,
}: {
  at: RelojKey;
  className?: string;
  style?: CSSProperties;
}) {
  const { hora, estado } = RELOJ[at];
  const covered = at === "cubierto";
  const sep = covered ? "text-on-brand/45" : "text-white/45";
  const [hh, mm] = hora.split(":");

  return (
    <p
      style={style}
      className={cn(
        "inline-flex max-w-full items-center gap-2 whitespace-nowrap rounded-full py-1.5 pl-2.5 pr-3.5 font-mono text-caption font-medium uppercase tracking-[0.12em] shadow-[var(--shadow-soft)]",
        covered ? "bg-secondary text-on-brand" : "bg-night text-white",
        className
      )}
    >
      {/* Un lector de pantalla lee el estado de una vez, no cada pedacito. */}
      <span className="sr-only">{`${hora}, turno de mozo: ${estado.toLowerCase()}`}</span>
      <span
        aria-hidden
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          covered ? "bg-on-brand-label" : at === "sinCubrir" ? "bg-danger" : "bg-manteca"
        )}
      />
      <span aria-hidden className="tabular-nums">
        {hh}
        <span className={covered ? undefined : "story-colon"}>:</span>
        {mm}
      </span>
      <span aria-hidden className={sep}>·</span>
      <span aria-hidden>Mozo</span>
      <span aria-hidden className={sep}>·</span>
      <span aria-hidden className={covered ? "text-on-brand-label" : "text-manteca"}>{estado}</span>
    </p>
  );
}
