"use client";

import type { Cuando, FiltrosMapa } from "@/lib/map/filtros-mapa";

const DIAS: ReadonlyArray<readonly [Cuando, string]> = [
  ["hoy", "Hoy"],
  ["manana", "Mañana"],
  ["finde", "Fin de semana"],
];

/**
 * Los chips de `/map` (2026-11-21): «Hoy», «Mañana», «Fin de semana» (uno a la
 * vez; tocar el elegido lo suelta) y «Paga más» (interruptor aparte). Una fila
 * que se desliza de costado si no entra. Cada chip se ve de 36 px pero el
 * botón mide 44 (lo que se toca). `cielo` = vidrio sobre el cielo del celular;
 * `panel` = chip suave en el panel de la compu. Reciben toques aunque el cielo
 * que los lleva no (`pointer-events-auto`).
 */
export default function FiltrosMapaChips({
  filtros,
  onChange,
  variante = "cielo",
}: {
  filtros: FiltrosMapa;
  onChange: (f: FiltrosMapa) => void;
  variante?: "cielo" | "panel";
}) {
  const cara = variante === "cielo" ? "chip-vidrio" : "chip-suave";
  return (
    <div
      role="group"
      aria-label="Filtrar turnos"
      className="chips-mapa pointer-events-auto no-scrollbar"
      data-variante={variante}
    >
      {DIAS.map(([clave, rotulo]) => (
        <button
          key={clave}
          type="button"
          aria-pressed={filtros.cuando === clave}
          onClick={() => onChange({ ...filtros, cuando: filtros.cuando === clave ? null : clave })}
          className="chip-mapa"
        >
          <span className={`${cara} chip-mapa-cara`}>{rotulo}</span>
        </button>
      ))}
      <button
        type="button"
        aria-pressed={filtros.pagaMas}
        onClick={() => onChange({ ...filtros, pagaMas: !filtros.pagaMas })}
        className="chip-mapa"
      >
        <span className={`${cara} chip-mapa-cara`}>
          <svg aria-hidden viewBox="0 0 10 10" width="11" height="11" className="shrink-0">
            <path d="M5 8.5v-7M1.8 4.6 5 1.4l3.2 3.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Paga más
        </span>
      </button>
    </div>
  );
}
