"use client";

import { memo, useState } from "react";
import { Marker } from "@vis.gl/react-maplibre";
import { StarIcon } from "@/components/icons";

interface WorkerMarkerProps {
  id: string;
  longitude: number;
  latitude: number;
  photoUrl: string | null;
  name: string;
  rating: number;
  active: boolean;
  /** Delay del scale-in de aparición, para el efecto stagger. */
  delayMs?: number;
  /** Recibe el `id` del trabajador: permite pasar un handler estable
   *  (useCallback en el padre) sin crear una closure nueva por marcador en
   *  cada render. */
  onClick: (id: string) => void;
}

/**
 * Marcador de trabajador (mapa del comercio, `/search`): avatar circular con
 * foto (o inicial de fallback) y mini-badge de rating. Seleccionado: escala
 * 1.25x + halo naranja, mismo patrón que `ShiftMarker`. Ver
 * docs/reference/MAPS_REDESIGN.md §5.
 *
 * Envuelto en `memo`: junto con el `onClick(id)` estable del padre, evita
 * que los N marcadores se re-rendericen todos al seleccionar uno solo.
 */
function WorkerMarker({
  id,
  longitude,
  latitude,
  photoUrl,
  name,
  rating,
  active,
  delayMs = 0,
  onClick,
}: WorkerMarkerProps) {
  const [broken, setBroken] = useState(false);
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const showPhoto = Boolean(photoUrl) && !broken;

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
      {/* Fill `both` mantiene scale(0) durante el delay del stagger; ver nota
          en ShiftMarker sobre por qué no usar la clase `scale-0`. */}
      <div
        className="origin-bottom [animation:markerPop_0.45s_cubic-bezier(0.3,1.4,0.5,1)_both]"
        style={{ animationDelay: `${delayMs}ms` }}
      >
        <button
          type="button"
          aria-label={`Ver perfil de ${name}`}
          aria-pressed={active}
          onClick={(e) => {
            e.stopPropagation();
            onClick(id);
          }}
          className={`relative flex h-[38px] w-[38px] items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-primary to-primary-strong shadow-[0_4px_10px_rgba(17,17,20,0.22)] transition-transform duration-300 ease-out ${
            active ? "scale-[1.25]" : "scale-100"
          }`}
        >
          {active && (
            <span className="absolute -inset-2 rounded-full border-2 border-primary [animation:markerHalo_1.6s_ease-out_infinite]" />
          )}
          {showPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl as string}
              alt={name}
              loading="lazy"
              decoding="async"
              onError={() => setBroken(true)}
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            <span className="text-sm font-bold text-white">{initial}</span>
          )}
          <span className="absolute -bottom-1 -right-1 flex items-center gap-0.5 rounded-full border border-white bg-night px-1 py-[1px] text-[9px] font-bold leading-tight text-white shadow-sm">
            <StarIcon size={8} filled className="text-rating" />
            {rating.toFixed(1)}
          </span>
        </button>
      </div>
    </Marker>
  );
}

export default memo(WorkerMarker);
