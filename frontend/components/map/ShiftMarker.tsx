"use client";

import { memo } from "react";
import { Marker } from "@vis.gl/react-maplibre";
import { SKILL_ACCENT } from "@/lib/skill-style";
import type { WorkerSkill } from "@/lib/types";

interface ShiftMarkerProps {
  id: string;
  longitude: number;
  latitude: number;
  position: WorkerSkill;
  urgent: boolean;
  active: boolean;
  /** Delay del scale-in de aparición, para el efecto stagger. */
  delayMs?: number;
  /** Recibe el `id` del turno: permite pasar un handler estable (useCallback
   *  en el padre) sin crear una closure nueva por marcador en cada render. */
  onClick: (id: string) => void;
}

/**
 * Marcador de turno: pastilla blanca redonda con el ícono del rubro en su
 * acento (`SKILL_ACCENT`). Seleccionado: escala 1.25x + halo naranja + "pico"
 * inferior. Urgente: punto rojo pulsante. Ver docs/reference/MAPS_REDESIGN.md §5.
 *
 * Envuelto en `memo`: junto con el `onClick(id)` estable del padre, evita
 * que los N marcadores se re-rendericen todos al seleccionar uno solo — sólo
 * cambian props (y por lo tanto re-renderizan) el que sale y el que entra de
 * `active`.
 */
function ShiftMarker({
  id,
  longitude,
  latitude,
  position,
  urgent,
  active,
  delayMs = 0,
  onClick,
}: ShiftMarkerProps) {
  const { Icon, fg } = SKILL_ACCENT[position];

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
          aria-label={`Ver turno de ${position}`}
          aria-pressed={active}
          onClick={(e) => {
            e.stopPropagation();
            onClick(id);
          }}
          className={`relative flex h-[38px] w-[38px] items-center justify-center rounded-full border-2 border-white bg-white shadow-[0_4px_10px_rgba(17,17,20,0.22)] transition-transform duration-300 ease-out ${
            active ? "scale-[1.25]" : "scale-100"
          }`}
        >
          {active && (
            <>
              <span className="absolute -inset-2 rounded-full border-2 border-primary [animation:markerHalo_1.6s_ease-out_infinite]" />
              <span className="absolute -bottom-[6px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 rounded-[2px] bg-white shadow-[2px_2px_4px_rgba(17,17,20,0.12)]" />
            </>
          )}
          <Icon size={19} strokeWidth={2.4} className={fg} />
          {urgent && (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-danger [animation:urgentPulse_1.2s_infinite]" />
          )}
        </button>
      </div>
    </Marker>
  );
}

export default memo(ShiftMarker);
