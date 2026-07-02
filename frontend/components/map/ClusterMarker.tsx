"use client";

import { Marker } from "@vis.gl/react-maplibre";

interface ClusterMarkerProps {
  longitude: number;
  latitude: number;
  count: number;
  delayMs?: number;
  onClick: () => void;
}

/** Burbuja blanca con conteo y aro naranja; tap -> zoom de expansión. */
export default function ClusterMarker({ longitude, latitude, count, delayMs = 0, onClick }: ClusterMarkerProps) {
  return (
    <Marker
      longitude={longitude}
      latitude={latitude}
      anchor="center"
      onClick={(e) => {
        e.originalEvent?.stopPropagation();
        onClick();
      }}
    >
      <div
        className="scale-0 [animation:markerPop_0.45s_cubic-bezier(0.3,1.4,0.5,1)_forwards]"
        style={{ animationDelay: `${delayMs}ms` }}
      >
        <button
          type="button"
          aria-label={`${count} turnos agrupados, tocá para acercar`}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-sm font-extrabold text-ink shadow-[0_4px_12px_rgba(17,17,20,0.2),0_0_0_4px_rgba(255,107,0,0.25)] transition-transform active:scale-90"
        >
          {count}
        </button>
      </div>
    </Marker>
  );
}
