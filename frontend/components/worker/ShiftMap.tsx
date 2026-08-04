"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MapRef, ViewStateChangeEvent } from "@vis.gl/react-maplibre";
import MapView from "@/components/map/MapView";
import UserPuck from "@/components/map/UserPuck";
import RadiusRing from "@/components/map/RadiusRing";
import ShiftMarker from "@/components/map/ShiftMarker";
import ClusterMarker from "@/components/map/ClusterMarker";
import { buildShiftClusterIndex, isCluster, type ShiftClusterFeature } from "@/lib/map/clustering";
import { easeToPoint, flyToPoint } from "@/lib/map/camera";
import { haversineKm } from "@/lib/map/geo";
import { Shift } from "@/lib/types";

/** Radio de búsqueda mostrado en el anillo (ver docs/reference/MAPS_REDESIGN.md §4.1). */
const SEARCH_RADIUS_KM = 2;

interface Viewport {
  bbox: [number, number, number, number];
  zoom: number;
}

function boundsToBbox(map: MapRef): [number, number, number, number] {
  const bounds = map.getBounds();
  return [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
}

/**
 * Mapa del worker en `/map`, reimplementado sobre el módulo `components/map/`
 * (MapLibre vectorial) manteniendo la misma interfaz de props que la versión
 * Leaflet anterior. Ver docs/reference/MAPS_REDESIGN.md §4/§5 y ADR-0001.
 */
export default function ShiftMap({
  shifts,
  center,
  activeId,
  onSelect,
}: {
  shifts: Shift[];
  center: [number, number];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const mapRef = useRef<MapRef | null>(null);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const initialCenterRef = useRef(center);
  const hasCenteredOnUserRef = useRef(false);

  const handleLoad = useCallback((map: MapRef) => {
    mapRef.current = map;
    setViewport({ bbox: boundsToBbox(map), zoom: map.getZoom() });
  }, []);

  const handleMoveEnd = useCallback((event: ViewStateChangeEvent) => {
    const map = event.target as unknown as MapRef;
    setViewport({ bbox: boundsToBbox(map), zoom: event.viewState.zoom });
  }, []);

  // Apertura: cuando se detecta la ubicación real (el `center` pasa de CABA
  // al usuario), volamos con una curva suave. Sólo la primera vez.
  useEffect(() => {
    if (hasCenteredOnUserRef.current || !mapRef.current) return;
    const [initLat, initLng] = initialCenterRef.current;
    if (center[0] === initLat && center[1] === initLng) return;
    hasCenteredOnUserRef.current = true;
    flyToPoint(mapRef.current, center, { zoom: 14, duration: 1400 });
  }, [center]);

  const active = shifts.find((s) => s.id === activeId);
  const activeLat = active?.latitude;
  const activeLng = active?.longitude;

  // Scroll del carrusel -> tarjeta activa -> paneo suave al marcador.
  useEffect(() => {
    if (!mapRef.current || activeLat == null || activeLng == null) return;
    easeToPoint(mapRef.current, [activeLat, activeLng], { duration: 450 });
  }, [activeLat, activeLng]);

  const clusterIndex = useMemo(() => buildShiftClusterIndex(shifts), [shifts]);

  const clusters = useMemo<ShiftClusterFeature[]>(() => {
    if (!viewport) return [];
    return clusterIndex.getClusters(viewport.bbox, Math.round(viewport.zoom));
  }, [clusterIndex, viewport]);

  // Stagger de aparición del más cercano al más lejano (docs/reference/MAPS_REDESIGN.md §5).
  const orderedClusters = useMemo(
    () =>
      [...clusters].sort((a, b) => {
        const da = haversineKm(center, [a.geometry.coordinates[1], a.geometry.coordinates[0]]);
        const db = haversineKm(center, [b.geometry.coordinates[1], b.geometry.coordinates[0]]);
        return da - db;
      }),
    [clusters, center]
  );

  const handleClusterClick = useCallback(
    (clusterId: number, lng: number, lat: number) => {
      if (!mapRef.current) return;
      const expansionZoom = Math.min(clusterIndex.getClusterExpansionZoom(clusterId), 18);
      easeToPoint(mapRef.current, [lat, lng], { zoom: expansionZoom, duration: 600 });
    },
    [clusterIndex]
  );

  // Handler estable para ShiftMarker: recibe el `id` en vez de cerrar sobre
  // la variable de cada iteración del `.map`, así React.memo puede evitar
  // re-renderizar los marcadores que no cambiaron al seleccionar uno.
  const handleShiftSelect = useCallback((id: string) => onSelect(id), [onSelect]);

  return (
    <MapView
      center={center}
      zoom={14}
      onLoad={handleLoad}
      onMoveEnd={handleMoveEnd}
      className="absolute inset-0 h-full w-full"
    >
      <UserPuck center={center} />
      <RadiusRing center={center} radiusKm={SEARCH_RADIUS_KM} />
      {orderedClusters.map((feature, index) => {
        const [lng, lat] = feature.geometry.coordinates;
        if (isCluster(feature)) {
          return (
            <ClusterMarker
              key={`cluster-${feature.properties.cluster_id}`}
              clusterId={feature.properties.cluster_id}
              longitude={lng}
              latitude={lat}
              count={feature.properties.point_count}
              delayMs={index * 80}
              onClick={handleClusterClick}
            />
          );
        }
        const { shiftId, position, urgent } = feature.properties;
        return (
          <ShiftMarker
            key={shiftId}
            id={shiftId}
            longitude={lng}
            latitude={lat}
            position={position}
            urgent={urgent}
            active={shiftId === activeId}
            delayMs={index * 80}
            onClick={handleShiftSelect}
          />
        );
      })}
    </MapView>
  );
}
