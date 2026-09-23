"use client";

import { useState } from "react";
import { SKILL_LABELS, Shift } from "@/lib/types";
import { formatShiftWhen } from "@/lib/datetime";
import { ClockIcon } from "@/components/icons";

/**
 * Resumen "Turnos activos" arriba del panel del comercio (board de Julieta,
 * pantalla del comercio): cuántos turnos tiene vivos, en qué están y cuál es
 * el próximo. Antes el panel arrancaba directo con la lista, y para saber
 * "¿cómo vengo hoy?" había que recorrer tarjeta por tarjeta.
 *
 * Verde bosque (`bg-secondary`), la superficie destacada del DS v5.0 — la
 * misma de la tarjeta "Recomendado" del trabajador. El ámbar sigue siendo de
 * la acción ("+ Publicar"), no de este resumen.
 */
export default function ActiveShiftsCard({
  searching,
  inProgress,
  className = "",
}: {
  /** Turnos publicados o buscando personal. */
  searching: Shift[];
  /** Turnos con alguien asignado que todavía no terminaron. */
  inProgress: Shift[];
  className?: string;
}) {
  // El "ahora" se toma una vez al montar (no en cada render: la regla de
  // pureza de React lo pide, y para elegir "el próximo turno" alcanza).
  const [now] = useState(() => Date.now());
  const active = [...searching, ...inProgress];
  if (active.length === 0) return null;

  const next = [...active]
    .filter((shift) => new Date(shift.end_at).getTime() > now)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())[0];

  const parts = [
    searching.length > 0 ? `${searching.length} buscando personal` : null,
    inProgress.length > 0 ? `${inProgress.length} en marcha` : null,
  ].filter(Boolean);

  return (
    <section
      aria-label="Turnos activos"
      data-testid="active-shifts-card"
      className={`rounded-[var(--radius-card)] bg-secondary p-4 shadow-[var(--shadow-float)] ${className}`}
    >
      <p className="text-xs font-bold uppercase tracking-wide text-white/65">Turnos activos</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-display text-[40px] font-medium leading-none text-white">{active.length}</span>
        <span className="text-sm text-white/80">{parts.join(" · ")}</span>
      </div>
      {next && (
        <p className="mt-3 flex items-center gap-1.5 border-t border-white/15 pt-3 text-sm text-white/90">
          <ClockIcon size={15} className="shrink-0 text-white/65" />
          <span className="min-w-0 truncate">
            Próximo: <span className="font-semibold text-white">{SKILL_LABELS[next.position]}</span>
            {" · "}
            {formatShiftWhen(next.start_at, next.end_at)}
          </span>
        </p>
      )}
    </section>
  );
}
