"use client";

import { Marker } from "@vis.gl/react-maplibre";
import { SKILL_ACCENT } from "@/lib/skill-style";
import type { WorkerSkill } from "@/lib/types";

interface ShiftMarkerProps {
  longitude: number;
  latitude: number;
  position: WorkerSkill;
  urgent: boolean;
  active: boolean;
  /** Delay del scale-in de aparición, para el efecto stagger. */
  delayMs?: number;
  onClick: () => void;
}

/**
 * Marcador de turno: pastilla blanca redonda con el ícono del rubro en su
 * acento (`SKILL_ACCENT`). Seleccionado: escala 1.25x + halo naranja + "pico"
 * inferior. Urgente: punto rojo pulsante. Ver docs/MAPS_REDESIGN.md §5.
 */
export default function ShiftMarker({
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
        onClick();
      }}
    >
      {/* Envoltorio: sólo maneja la animación de aparición (scale-in con
          stagger). El escalado por selección vive en el botón interior para
          no pelear transforms con la misma propiedad CSS. */}
      <div
        className="origin-bottom scale-0 [animation:markerPop_0.45s_cubic-bezier(0.3,1.4,0.5,1)_forwards]"
        style={{ animationDelay: `${delayMs}ms` }}
      >
        <button
          type="button"
          aria-label={`Ver turno de ${position}`}
          aria-pressed={active}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
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
