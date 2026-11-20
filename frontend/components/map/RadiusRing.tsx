"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Layer, Source, useMap } from "@vis.gl/react-maplibre";
import { circlePolygonCoordinates } from "@/lib/map/geo";

const SOURCE_ID = "shift-radius-ring";
const ANIMATION_MS = 1100;

function anillo(center: [number, number], radiusKm: number): GeoJSON.Feature<GeoJSON.Polygon> {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [circlePolygonCoordinates(center, Math.max(radiusKm, 0.01))] },
  };
}

// Constantes de módulo: la animación re-renderiza el anillo en cada cuadro y,
// con objetos nuevos, `Layer` volvía a comparar y reaplicar el estilo en cada uno.
// Azul hondo (dirección suave, 2026-11-20): era ámbar, y el ámbar de la
// pantalla es el de la acción. Sólo lo usa `/map`.
const FILL_PAINT = { "fill-color": "#2a73a3", "fill-opacity": 0.06 };
const LINE_PAINT = {
  "line-color": "#2a73a3",
  "line-opacity": 0.45,
  "line-width": 1.5,
  "line-dasharray": [2, 2],
};

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
  const { current: map } = useMap();
  // La animación NO pasa por React: antes cada cuadro era un `setState` y un
  // render del anillo (~60 commits en la primera segundos de /map). Ahora se
  // empuja la geometría directo a la fuente del mapa y React sólo se entera
  // al terminar (`terminado`), cuando el anillo pasa a su tamaño final.
  const [terminado, setTerminado] = useState(prefersReducedMotion);
  const centerRef = useRef(center);
  const radiusRef = useRef(radiusKm);
  useEffect(() => {
    centerRef.current = center;
    radiusRef.current = radiusKm;
  });

  useEffect(() => {
    if (terminado) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ANIMATION_MS);
      if (t >= 1) {
        setTerminado(true);
        return;
      }
      const progress = 1 - Math.pow(1 - t, 3); // easeOutCubic
      // La fuente puede no estar todavía (el estilo del mapa carga aparte):
      // se salta el cuadro y se prueba en el siguiente.
      const source = map?.getSource(SOURCE_ID) as { setData?: (d: GeoJSON.Feature) => void } | undefined;
      source?.setData?.(anillo(centerRef.current, radiusRef.current * progress));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [terminado, map]);

  // Antes de terminar, el dato de la prop es el punto inicial (radio 0): la
  // fuente sólo lo recibe al montar, el resto lo pone la animación.
  // Mientras anima, `center`/`radiusKm` no entran en las dependencias: si
  // cambian a mitad, el dato de la fuente se queda quieto y no pisa la animación.
  const centroFinal = terminado ? center : null;
  const radioFinal = terminado ? radiusKm : 0;
  const geojson = useMemo(
    () => anillo(centroFinal ?? center, radioFinal),
    // `center` sólo cuenta una vez terminado (ver arriba).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [centroFinal, radioFinal]
  );

  return (
    <Source id={SOURCE_ID} type="geojson" data={geojson}>
      <Layer id={`${SOURCE_ID}-fill`} type="fill" paint={FILL_PAINT} />
      <Layer id={`${SOURCE_ID}-line`} type="line" paint={LINE_PAINT} />
    </Source>
  );
}
