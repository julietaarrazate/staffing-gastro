"use client";

import { memo } from "react";
import { Marker } from "@vis.gl/react-maplibre";
import { SKILL_ACCENT } from "@/lib/skill-style";
import { formatArs } from "@/lib/format";
import type { WorkerSkill } from "@/lib/types";

interface ShiftMarkerProps {
  id: string;
  longitude: number;
  latitude: number;
  position: WorkerSkill;
  /** Pago del turno: es el contenido del marcador, no un dato secundario. */
  payAmount: string | number;
  urgent: boolean;
  active: boolean;
  /** Delay del scale-in de aparición, para el efecto stagger. */
  delayMs?: number;
  /** Recibe el `id` del turno: permite pasar un handler estable (useCallback
   *  en el padre) sin crear una closure nueva por marcador en cada render. */
  onClick: (id: string) => void;
}

/**
 * Marcador de turno: pastilla con EL PAGO adentro (rediseño de mapa, 2026-09).
 *
 * Antes era un círculo de 38px con el ícono del rubro. El problema no era
 * estético: un trabajador abre el mapa para saber qué hay cerca y CUÁNTO PAGA,
 * y con el ícono solo esa segunda mitad de la pregunta costaba un toque por
 * pin. Ahora el marcador lleva el monto —el dato que decide si vale la pena
 * abrirlo— y el rubro sigue presente como punto de color, no como ícono, para
 * no volver a llenar la pastilla.
 *
 * Estados (docs/reference/MAPS_REDESIGN.md §5, ampliado):
 *   - reposo  → carbón, se lee sin pedir atención.
 *   - urgente → punto rojo pulsante: hay actividad ahora.
 *   - activo  → pasa a naranja, escala y saca el "pico" hacia el punto exacto.
 *
 * Pendiente: el estado "match" (oportunidad especialmente compatible) necesita
 * un score de compatibilidad que hoy el turno no trae del backend.
 */
function ShiftMarker({
  id,
  longitude,
  latitude,
  position,
  payAmount,
  urgent,
  active,
  delayMs = 0,
  onClick,
}: ShiftMarkerProps) {
  const { fg } = SKILL_ACCENT[position];

  return (
    <Marker
      longitude={longitude}
      latitude={latitude}
      anchor="bottom"
      onClick={(e) => {
        e.originalEvent?.stopPropagation();
        onClick(id);
      }}
    >
      {/* Envoltorio: sólo maneja la animación de aparición (scale-in con
          stagger). El escalado por selección vive en el botón interior para
          no pelear transforms con la misma propiedad CSS. El fill `both`
          mantiene scale(0) durante el delay del stagger; NO usar la clase
          `scale-0` (en Tailwind v4 setea la propiedad `scale`, que se compone
          con el transform de la animación y deja el marcador invisible). */}
      <div
        className="origin-bottom [animation:markerPop_0.45s_cubic-bezier(0.3,1.4,0.5,1)_both]"
        style={{ animationDelay: `${delayMs}ms` }}
      >
        <button
          type="button"
          aria-label={`Turno de ${position}, ${formatArs(payAmount)}`}
          aria-pressed={active}
          onClick={(e) => {
            e.stopPropagation();
            onClick(id);
          }}
          className={`relative flex items-center gap-1.5 rounded-full border-2 border-white px-2.5 py-1.5 text-xs font-bold tabular-nums transition-transform duration-300 ease-out ${
            active
              ? "scale-[1.14] bg-primary text-night shadow-[var(--shadow-primary)]"
              : "scale-100 bg-night text-white shadow-[0_4px_10px_rgba(17,17,20,0.22)]"
          }`}
        >
          {active && (
            <span className="absolute -bottom-[6px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 rounded-[2px] bg-primary" />
          )}
          {/* El rubro pasa a ser un punto de color en vez de un ícono: mantiene
              la lectura por oficio sin robarle lugar al monto. Activo hereda el
              carbón para no perder contraste sobre el naranja. */}
          <span
            aria-hidden
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              active ? "bg-night" : fg.replace("text-", "bg-")
            }`}
          />
          {formatArs(payAmount)}
          {urgent && (
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-danger [animation:urgentPulse_1.2s_infinite]" />
          )}
        </button>
      </div>
    </Marker>
  );
}

export default memo(ShiftMarker);
