"use client";

import { memo, useState } from "react";
import { Marker } from "@vis.gl/react-maplibre";
import { StarIcon } from "@/components/icons";
import { formatRating, hasRating } from "@/lib/reputation";

interface WorkerMarkerProps {
  id: string;
  longitude: number;
  latitude: number;
  photoUrl: string | null;
  name: string;
  rating: number;
  active: boolean;
  /** ADR-0014: "Disponible ahora" vigente — punto verde en la esquina
   *  opuesta al rating, mismo criterio visual que un estado "en vivo". */
  isLive?: boolean;
  /** Delay del scale-in de aparición, para el efecto stagger. */
  delayMs?: number;
  /** Recibe el `id` del trabajador: permite pasar un handler estable
   *  (useCallback en el padre) sin crear una closure nueva por marcador en
   *  cada render. */
  onClick: (id: string) => void;
}

/**
 * Marcador de trabajador (mapa del comercio, `/search`): una tecla blanca
 * redonda con aro fino (`.pin-trabajador` en `globals.css`), con la foto o, sin
 * foto, la inicial sobre el celeste de la marca, y la nota en una pastilla
 * blanca en la esquina. «Disponible ahora»: el punto verde. Seleccionado:
 * escala 1.25x con el aro en azul hondo. Mismo lenguaje que `ShiftMarker`
 * (dirección suave, ADR-0028). Ver docs/reference/MAPS_REDESIGN.md §5.
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
  isLive = false,
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
          className="pin-trabajador"
        >
          {isLive && (
            <span
              aria-label="Disponible ahora"
              className="pin-vivo absolute -right-0.5 -top-0.5 z-10 h-3 w-3 rounded-full bg-success"
            />
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
            <span className="pin-trabajador-inicial">{initial}</span>
          )}
          {hasRating(rating) && (
            <span className="pin-nota">
              <StarIcon size={9} filled className="text-rating" />
              {formatRating(rating)}
            </span>
          )}
        </button>
      </div>
    </Marker>
  );
}

export default memo(WorkerMarker);
