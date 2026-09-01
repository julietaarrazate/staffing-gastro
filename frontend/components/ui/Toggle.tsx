"use client";

import type { ReactNode } from "react";

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
      className="flex items-center justify-between rounded-2xl bg-card px-4 py-3 ring-1 ring-line outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink/80">
        {icon} {label}
      </span>
      <span
        className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-success" : "bg-line"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}
