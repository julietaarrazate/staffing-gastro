"use client";

import { useEffect, useMemo, useState } from "react";
import { Layer, Source } from "@vis.gl/react-maplibre";
import { circlePolygonCoordinates } from "@/lib/map/geo";

const SOURCE_ID = "shift-radius-ring";
const ANIMATION_MS = 1100;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Anillo del radio de búsqueda (~2 km) como capa GeoJSON (fill + line): así
 * escala solo con el zoom del mapa, sin recalcular píxeles a mano. Entra con
 * una animación de expansión (radio 0 -> objetivo) al montar.
 */
export default function RadiusRing({
  center,
  radiusKm = 2,
}: {
  center: [number, number];
  radiusKm?: number;
}) {
  const [progress, setProgress] = useState(() => (prefersReducedMotion() ? 1 : 0));

  useEffect(() => {
    if (progress >= 1) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ANIMATION_MS);
      setProgress(1 - Math.pow(1 - t, 3)); // easeOutCubic
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // Sólo corre una vez, al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const geojson = useMemo<GeoJSON.Feature<GeoJSON.Polygon>>(
    () => ({
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [circlePolygonCoordinates(center, Math.max(radiusKm * progress, 0.01))],
      },
    }),
    [center, radiusKm, progress]
  );

  return (
    <Source id={SOURCE_ID} type="geojson" data={geojson}>
      <Layer id={`${SOURCE_ID}-fill`} type="fill" paint={{ "fill-color": "#d97706", "fill-opacity": 0.06 }} />
      <Layer
        id={`${SOURCE_ID}-line`}
        type="line"
        paint={{ "line-color": "#d97706", "line-opacity": 0.45, "line-width": 1.5, "line-dasharray": [2, 2] }}
      />
    </Source>
  );
}
