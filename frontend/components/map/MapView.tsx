"use client";

// Único punto de importación del CSS de MapLibre (doc §4.6: "un solo
// contexto WebGL reutilizado... CSS de maplibre importado una vez").
import "maplibre-gl/dist/maplibre-gl.css";

import { forwardRef, useImperativeHandle, useRef, type ReactNode } from "react";
import { AttributionControl, Map as MapGl, type MapRef, type ViewStateChangeEvent } from "@vis.gl/react-maplibre";
import { MAP_STYLE_URL } from "@/lib/map/style";

export interface MapViewProps {
  /** Centro inicial `[lat, lng]`. Vista no controlada: sólo se usa al montar. */
  center: [number, number];
  zoom?: number;
  children?: ReactNode;
  onLoad?: (map: MapRef) => void;
  onMoveEnd?: (event: ViewStateChangeEvent) => void;
  className?: string;
}

/**
 * Mapa base vectorial del módulo `components/map/`: ninguna otra pantalla
 * importa `maplibre-gl` directamente (ver docs/MAPS_REDESIGN.md §4.1 y
 * ADR-0001). Estilo CARTO Voyager GL, atribución compacta, sin logo.
 */
const MapView = forwardRef<MapRef, MapViewProps>(function MapView(
  { center, zoom = 14, children, onLoad, onMoveEnd, className },
  forwardedRef
) {
  const mapRef = useRef<MapRef>(null);
  useImperativeHandle(forwardedRef, () => mapRef.current as MapRef, []);

  return (
    <MapGl
      ref={mapRef}
      reuseMaps
      initialViewState={{ longitude: center[1], latitude: center[0], zoom }}
      mapStyle={MAP_STYLE_URL}
      attributionControl={false}
      style={{ width: "100%", height: "100%" }}
      className={className}
      onLoad={() => {
        if (mapRef.current) onLoad?.(mapRef.current);
      }}
      onMoveEnd={onMoveEnd}
    >
      <AttributionControl compact position="bottom-right" />
      {children}
    </MapGl>
  );
});

export default MapView;
