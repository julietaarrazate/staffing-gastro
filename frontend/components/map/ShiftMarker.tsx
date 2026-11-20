"use client";

import { memo } from "react";
import { Marker } from "@vis.gl/react-maplibre";
import { formatArs } from "@/lib/format";
import { SKILL_LABELS, type WorkerSkill } from "@/lib/types";

interface ShiftMarkerProps {
  id: string;
  longitude: number;
  latitude: number;
  position: WorkerSkill;
  /** Pago del turno: es el contenido del marcador, no un dato secundario. */
  payAmount: string | number;
  /** El pago ya escrito ("$10.000/h" en un turno reofrecido). Sin él, el monto. */
  payLabel?: string;
  urgent: boolean;
  active: boolean;
  /** Paga por encima de lo típico para su puesto y ciudad (ADR-0012). */
  isMatch: boolean;
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
 * Dirección suave (ADR-0028, maqueta `T-Mapa`, 2026-11-20): el pin es una
 * tecla blanca con su pico (`.pin-turno` en `globals.css`) y el elegido va en
 * azul hondo, más grande. Se fue el punto de color por rubro: el rubro lo
 * dice el nombre accesible y la tarjeta del turno.
 *
 * Estados:
 *   - reposo  → tecla blanca (de noche, azul noche), con el pago en tinta.
 *   - urgente → punto rojo pulsante: hay actividad ahora.
 *   - match   → una flechita verde antes del monto: paga por encima de lo
 *               típico para ese puesto en esa ciudad (ADR-0012). No usa el
 *               ámbar: el ámbar es de la acción de la pantalla.
 *   - activo  → azul hondo con letra blanca y más grande. Gana sobre match:
 *               cuál está seleccionado no puede quedar ambiguo.
 */
function ShiftMarker({
  id,
  longitude,
  latitude,
  position,
  payAmount,
  payLabel,
  urgent,
  active,
  isMatch,
  delayMs = 0,
  onClick,
}: ShiftMarkerProps) {
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
        className="relative origin-bottom [animation:markerPop_0.45s_cubic-bezier(0.3,1.4,0.5,1)_both]"
        style={{ animationDelay: `${delayMs}ms` }}
      >
        {/* Al tocarlo, una onda azul sale del pin UNA vez (se monta con
            `active`, así que se repite en cada selección y no queda
            latiendo): confirma "este es el que elegiste" sin quedarse
            como ruido en el mapa. */}
        {active && (
          <span
            aria-hidden
            className="pin-onda pointer-events-none absolute -inset-1.5 rounded-full [animation:markerHalo_0.6s_ease-out_1_both]"
          />
        )}
        <button
          type="button"
          aria-label={`Turno de ${SKILL_LABELS[position]}, ${payLabel ?? formatArs(payAmount)}${
            isMatch ? ", paga por encima de lo habitual" : ""
          }`}
          aria-pressed={active}
          onClick={(e) => {
            e.stopPropagation();
            onClick(id);
          }}
          className="pin-turno"
        >
          {isMatch && (
            <svg aria-hidden viewBox="0 0 10 10" width="10" height="10" className="pin-paga-mas shrink-0">
              <path d="M5 8.5v-7M1.8 4.6 5 1.4l3.2 3.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          <span>{payLabel ?? formatArs(payAmount)}</span>
          {urgent && (
            <span className="pin-urgente absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-danger [animation:urgentPulse_1.2s_infinite]" />
          )}
        </button>
      </div>
    </Marker>
  );
}

export default memo(ShiftMarker);
