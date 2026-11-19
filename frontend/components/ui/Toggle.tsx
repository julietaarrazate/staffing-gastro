"use client";

import type { ReactNode } from "react";
import { CheckIcon } from "@/components/icons";

/**
 * Switch on/off del Design System, con label e ícono opcional. Antes estaba
 * duplicado idéntico en `shifts/new/page.tsx` y `shifts/new-event/page.tsx`
 * (copy-paste); se promovió acá para no seguir divergiendo (pasada de
 * calidad, EPIC Product Quality & UX Consistency).
 */
export default function Toggle({
  label,
  checked,
  onChange,
  icon,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      // `tecla` y `casilla`: los ganchos de la dirección suave (ADR-0028). Adentro
      // de `.estilo-suave` la fila es una tecla y el estado una casilla redonda
      // con el tilde; afuera, el interruptor de siempre.
      className="tecla flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 text-left ring-1 ring-line outline-none"
    >
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
        {icon} {label}
      </span>
      <span aria-hidden className="casilla h-6 w-6 shrink-0 items-center justify-center">
        {checked && <CheckIcon size={15} />}
      </span>
      <span
        className={`interruptor relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-success" : "bg-line"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}
