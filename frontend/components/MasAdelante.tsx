"use client";

import { useState } from "react";
import { fechaCorta } from "@/lib/semana";

/** Una fila de «Más adelante»: un turno de una semana que todavía no se ve. */
export interface FilaFutura {
  id: string;
  /** "YYYY-MM-DD" en Argentina. */
  clave: string;
  puesto: string;
  estado: string;
  /** Clase de color del estado (`text-success-text`…). */
  tono: string;
  pago: string;
}

/** Cuántas filas se ven antes de «Ver los N que siguen». */
export const TOPE_MAS_ADELANTE = 3;

/**
 * El último grupo de la lista: los turnos de semanas que vienen, en filas de
 * una línea y sin acciones (fecha corta · puesto · estado · pago), para que al
 * mirar una semana no desaparezca lo que viene después. Tocar una fila avisa
 * su día (`onElegir`) para saltar a su semana con ese día elegido. Muestra
 * tres; el resto, con «Ver los N que siguen». Lo pasado no se lista. Pieza
 * compartida (Mis turnos y el Panel del comercio). Sin filas no pinta nada.
 */
export default function MasAdelante({ filas, onElegir }: { filas: FilaFutura[]; onElegir: (clave: string) => void }) {
  const [todas, setTodas] = useState(false);
  if (filas.length === 0) return null;
  const vistas = todas ? filas : filas.slice(0, TOPE_MAS_ADELANTE);
  const resto = filas.length - TOPE_MAS_ADELANTE;
  return (
    <section data-testid="mas-adelante" className="mt-8 min-w-0">
      <h2 className="titulo-seccion mb-3">
        Más adelante
        <span className="ml-1.5 text-sm font-semibold text-ink-soft">{filas.length}</span>
      </h2>
      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- sin viñetas, Safari le saca el rol de lista */}
      <ul role="list" className="flex flex-col gap-2 md:max-w-xl">
        {vistas.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              onClick={() => onElegir(f.clave)}
              className="turno-fila mas-adelante-fila"
              aria-label={`${fechaCorta(f.clave)}, ${f.puesto}, ${f.estado}, ${f.pago}. Ver esa semana`}
            >
              <span className="mas-adelante-fecha">{fechaCorta(f.clave)}</span>
              <span className="mas-adelante-puesto">{f.puesto}</span>
              <span className={`shrink-0 text-xs font-bold ${f.tono}`}>{f.estado}</span>
              <span className="mas-adelante-pago">{f.pago}</span>
            </button>
          </li>
        ))}
      </ul>
      {!todas && resto > 0 && (
        <button
          type="button"
          onClick={() => setTodas(true)}
          className="mt-1 flex min-h-[44px] items-center px-1 text-sm font-bold text-primary-text"
        >
          Ver {resto === 1 ? "el que sigue" : `los ${resto} que siguen`}
        </button>
      )}
    </section>
  );
}
