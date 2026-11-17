"use client";

import { cn } from "@/lib/cn";
import type { Opcion } from "@/lib/encuesta";

/**
 * Opciones como botones grandes, para tocar con el pulgar. De una sola
 * (`radio`) o de varias (`checkbox`). La elegida va en celeste con el anillo
 * en azul hondo: el ámbar queda para el botón de seguir (un solo acento por
 * pantalla). El marcador de la izquierda (círculo o cuadrado) dice cuántas
 * se pueden elegir; no es un adorno.
 */
export function OpcionUnica<T extends string>({
  opciones,
  valor,
  onChange,
  nombre,
}: {
  opciones: Opcion<T>[];
  valor: T | null;
  onChange: (v: T) => void;
  nombre: string;
}) {
  return (
    <div role="radiogroup" aria-label={nombre} className="flex flex-col gap-2.5">
      {opciones.map((o) => (
        <Boton
          key={o.valor}
          etiqueta={o.etiqueta}
          activa={valor === o.valor}
          forma="radio"
          onClick={() => onChange(o.valor)}
        />
      ))}
    </div>
  );
}

export function OpcionMultiple<T extends string>({
  opciones,
  valores,
  onChange,
  nombre,
}: {
  opciones: Opcion<T>[];
  valores: T[];
  onChange: (v: T[]) => void;
  nombre: string;
}) {
  return (
    <div role="group" aria-label={nombre} className="flex flex-col gap-2.5">
      {opciones.map((o) => {
        const activa = valores.includes(o.valor);
        return (
          <Boton
            key={o.valor}
            etiqueta={o.etiqueta}
            activa={activa}
            forma="checkbox"
            onClick={() =>
              onChange(activa ? valores.filter((v) => v !== o.valor) : [...valores, o.valor])
            }
          />
        );
      })}
    </div>
  );
}

function Boton({
  etiqueta,
  activa,
  forma,
  onClick,
}: {
  etiqueta: string;
  activa: boolean;
  forma: "radio" | "checkbox";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role={forma}
      aria-checked={activa}
      onClick={onClick}
      className={cn(
        "flex min-h-[56px] w-full items-center gap-3 rounded-[var(--radius-btn)] px-4 py-3 text-left text-base font-semibold transition active:scale-[0.99]",
        activa
          ? "bg-secondary text-on-brand ring-2 ring-primary-text"
          : "bg-card text-ink ring-1 ring-line hover:bg-surface"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid h-6 w-6 shrink-0 place-items-center text-sm font-bold leading-none",
          forma === "radio" ? "rounded-full" : "rounded-[var(--radius-chip)]",
          activa
            ? "bg-primary-text text-card"
            : "bg-transparent text-transparent ring-2 ring-inset ring-ink-mute/50"
        )}
      >
        ✓
      </span>
      <span>{etiqueta}</span>
    </button>
  );
}
