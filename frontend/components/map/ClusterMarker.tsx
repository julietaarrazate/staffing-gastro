"use client";

import { memo } from "react";
import { Marker } from "@vis.gl/react-maplibre";

interface ClusterMarkerProps {
  clusterId: number;
  longitude: number;
  latitude: number;
  count: number;
  delayMs?: number;
  /** Recibe `(clusterId, longitude, latitude)` del propio marcador: permite
   *  pasar un handler estable (useCallback en el padre) sin crear una
   *  closure nueva por cluster en cada render. */
  onClick: (clusterId: number, longitude: number, latitude: number) => void;
}

/**
 * Burbuja blanca con conteo y aro naranja; tap -> zoom de expansión.
 *
 * Envuelto en `memo`: junto con el `onClick` estable del padre, evita
 * re-renderizar todos los clusters al seleccionar un marcador individual.
 */
function ClusterMarker({ clusterId, longitude, latitude, count, delayMs = 0, onClick }: ClusterMarkerProps) {
  return (
    <Marker
      longitude={longitude}
      latitude={latitude}
      anchor="center"
      onClick={(e) => {
        e.originalEvent?.stopPropagation();
        onClick(clusterId, longitude, latitude);
      }}
    >
      {/* Fill `both`: mantiene scale(0) durante el delay. NO usar `scale-0`
          (propiedad `scale` de Tailwind v4, se compone con el transform de la
          animación y deja la burbuja invisible). */}
      <div
        className="[animation:markerPop_0.45s_cubic-bezier(0.3,1.4,0.5,1)_both]"
        style={{ animationDelay: `${delayMs}ms` }}
      >
        <button
          type="button"
          aria-label={`${count} turnos agrupados, tocá para acercar`}
          onClick={(e) => {
            e.stopPropagation();
            onClick(clusterId, longitude, latitude);
          }}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-sm font-extrabold text-ink shadow-[0_4px_12px_rgba(17,17,20,0.2),0_0_0_4px_rgba(249,78,27,0.25)] transition-transform active:scale-90"
        >
          {count}
        </button>
      </div>
    </Marker>
  );
}

export default memo(ClusterMarker);
