"use client";

import { motion, useReducedMotion } from "motion/react";
import { MOTION_UI } from "@/lib/motion";

/**
 * Barra de progreso para una proporción contra un límite (puntualidad del
 * trabajador, pago a tiempo del comercio) — no un stat tile de texto
 * plano. El relleno lleva la severidad (Ley de marca: verde/rojo sólo de
 * estado, nunca decorativo); el track sin llenar es un escalón más claro
 * de la MISMA rampa (el tinte bajo su color sólido, tokens `-tint`), para
 * que el estado se lea en la barra entera, no sólo en el número.
 */
const SEVERITY = {
  good: { fill: "bg-success", track: "bg-success-tint", text: "text-success-text" },
  ok: { fill: "bg-primary", track: "bg-primary-tint", text: "text-primary-text" },
  low: { fill: "bg-danger", track: "bg-danger-tint", text: "text-danger-text" },
  // Sin historial: el backend guarda 0.0 por default (ver
  // `worker/infrastructure/models.py`/`company/infrastructure/models.py`),
  // que NO es "mal desempeño" — es "todavía no hay datos". Mostrarlo en
  // rojo sería una alarma falsa contra alguien recién registrado.
  neutral: { fill: "bg-line", track: "bg-surface", text: "text-ink/40" },
} as const;

function severityOf(rate: number): keyof typeof SEVERITY {
  if (rate >= 0.9) return "good";
  if (rate >= 0.7) return "ok";
  return "low";
}

export default function RateMeter({
  label,
  rate,
  hasHistory = true,
}: {
  label: string;
  rate: number;
  /** false = todavía no hay turnos/pagos que promediar (ver nota arriba). */
  hasHistory?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const pct = Math.round(Math.min(1, Math.max(0, rate)) * 100);
  const severity = hasHistory ? SEVERITY[severityOf(rate)] : SEVERITY.neutral;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold font-mono uppercase tracking-wide text-ink/40">{label}</span>
        <span className={`text-sm font-extrabold ${severity.text}`}>
          {hasHistory ? `${pct}%` : "Sin datos"}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={hasHistory ? pct : undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={hasHistory ? `${label}: ${pct}%` : `${label}: sin datos todavía`}
        className={`mt-1.5 h-2.5 w-full overflow-hidden rounded-full ${severity.track}`}
      >
        {hasHistory && (
          <motion.div
            initial={reducedMotion ? false : { width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={reducedMotion ? { duration: 0 } : MOTION_UI}
            className={`h-full rounded-full ${severity.fill}`}
          />
        )}
      </div>
    </div>
  );
}
