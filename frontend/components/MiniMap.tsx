"use client";

import { Marker } from "@vis.gl/react-maplibre";
import MapView from "@/components/map/MapView";

/**
 * Thumbnail estático (no interactivo) del detalle de turno, reimplementado
 * sobre `MapView` con el mismo motor vectorial que el resto del mapa (antes
 * era un `<img>` de tiles raster de Leaflet). Ver docs/reference/MAPS_REDESIGN.md §8.
 */
export default function MiniMap({
  latitude,
  longitude,
  className = "h-28 w-full",
}: {
  latitude: number;
  longitude: number;
  className?: string;
}) {
  return (
    <MapView
      center={[latitude, longitude]}
      zoom={14}
      interactive={false}
      attribution={false}
      className={`${className} rounded-2xl`}
    >
      <Marker longitude={longitude} latitude={latitude} anchor="center">
        <div className="h-4 w-4 rounded-full border-[3px] border-white bg-primary shadow-[0_0_0_2px_rgba(249,115,22,0.35)]" />
      </Marker>
    </MapView>
  );
}
