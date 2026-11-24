"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MapRef, ViewStateChangeEvent } from "@vis.gl/react-maplibre";
import MapView from "@/components/map/MapView";
import UserPuck from "@/components/map/UserPuck";
import RadiusRing from "@/components/map/RadiusRing";
import ShiftMarker from "@/components/map/ShiftMarker";
import ClusterMarker from "@/components/map/ClusterMarker";
import { buildShiftClusterIndex, isCluster, type ShiftClusterFeature } from "@/lib/map/clustering";
import {
  createBottomPaddingApplier,
  easeToPoint,
  flyToPoint,
  type BottomPaddingApplier,
} from "@/lib/map/camera";
import { haversineKm } from "@/lib/map/geo";
import { anchoEstimadoPin, colocarPastillas, proyectarEnEncuadre, type PinParaPastilla } from "@/lib/map/pastillas";
import { Shift } from "@/lib/types";

/** Desde este zoom el nombre del local se ve al lado de cada pin. */
const ZOOM_NOMBRES = 15;

/** Radio de búsqueda mostrado en el anillo (ver docs/reference/MAPS_REDESIGN.md §4.1). */
const SEARCH_RADIUS_KM = 2;

interface Viewport {
  bbox: [number, number, number, number];
  zoom: number;
  /** Tamaño visible del mapa (px), para ubicar las pastillas de los nombres. */
  ancho: number;
  alto: number;
}

function medir(map: MapRef, zoom: number): Viewport {
  const c = map.getContainer();
  return { bbox: boundsToBbox(map), zoom, ancho: c.clientWidth, alto: c.clientHeight };
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
  followActive,
  bottomPadding = 0,
  sinOrigen = false,
}: {
  shifts: Shift[];
  center: [number, number];
  activeId: string | null;
  onSelect: (id: string) => void;
  /** Si la cámara acompaña a la tarjeta activa. Al abrir es `false`: el mapa
   * se queda en la persona y recién sigue a una tarjeta cuando ella toca o
   * desliza (o cuando no hay GPS, ver `app/map/page.tsx`). */
  followActive: boolean;
  /** Alto en px que la hoja de tarjetas tapa abajo (mobile). La cámara lo deja
   * libre para que el encuadre y los vuelos caigan arriba de la hoja. */
  bottomPadding?: number;
  /** `true` si `center` no es dónde está la persona (sólo un lugar para abrir el
   * mapa): no se dibuja el punto azul ni el anillo de cercanía. */
  sinOrigen?: boolean;
}) {
  const mapRef = useRef<MapRef | null>(null);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const initialCenterRef = useRef(center);
  const hasCenteredOnUserRef = useRef(false);
  // ESTADO, no sólo la ref: los dos efectos de cámara de abajo necesitan
  // volver a correr cuando el mapa termina de cargar. Con sólo `mapRef` no
  // pueden — mutar una ref no dispara ningún re-render, así que un efecto que
  // salió temprano porque `mapRef.current` era `null` NO se reintenta nunca.
  // Ésa es la raíz de "el mapa no apunta a donde le pido", reportada varias
  // veces: la orden de cámara se emitía antes de que el mapa existiera y se
  // perdía en silencio. Con `ready` en las dependencias, cada intención de
  // cámara se re-aplica en cuanto hay mapa.
  const [ready, setReady] = useState(false);

  const handleLoad = useCallback((map: MapRef) => {
    mapRef.current = map;
    setViewport(medir(map, map.getZoom()));
    setReady(true);
  }, []);

  const handleMoveEnd = useCallback((event: ViewStateChangeEvent) => {
    const map = event.target as unknown as MapRef;
    setViewport(medir(map, event.viewState.zoom));
  }, []);

  // Padding inferior = alto de la hoja. Va ANTES de los efectos de vuelo (el
  // orden de los efectos es el del archivo). Con el mapa quieto se aplica en el
  // momento; en movimiento, al `moveend` (ver `createBottomPaddingApplier`). Todo
  // vuelo programático sale con el padding vigente (`paddingRef`).
  const paddingRef = useRef(bottomPadding);
  const applierRef = useRef<BottomPaddingApplier | null>(null);
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const applier = createBottomPaddingApplier(mapRef.current);
    applierRef.current = applier;
    return () => {
      applier.cancel();
      applierRef.current = null;
    };
  }, [ready]);
  useEffect(() => {
    paddingRef.current = bottomPadding;
    applierRef.current?.apply(bottomPadding);
  }, [bottomPadding, ready]);
  // Con `reuseMaps` el mapa vuelve al pool: sin esto otra pantalla heredaría
  // el padding de esta.
  useEffect(
    () => () => {
      try {
        mapRef.current?.jumpTo({ padding: { top: 0, left: 0, right: 0, bottom: 0 } });
      } catch {
        // el mapa ya se destruyó
      }
    },
    []
  );

  // Apertura: cuando se detecta la ubicación real (el `center` pasa de CABA
  // al usuario), volamos con una curva suave. Sólo la primera vez.
  useEffect(() => {
    if (hasCenteredOnUserRef.current || !mapRef.current) return;
    const [initLat, initLng] = initialCenterRef.current;
    if (center[0] === initLat && center[1] === initLng) return;
    hasCenteredOnUserRef.current = true;
    const options = { zoom: 14, duration: 1400, bottomPadding: paddingRef.current };
    flyToPoint(mapRef.current, center, options);
  }, [center, ready]);

  const active = shifts.find((s) => s.id === activeId);
  const activeLat = active?.latitude;
  const activeLng = active?.longitude;

  // Scroll del carrusel -> tarjeta activa -> paneo al marcador de ESE turno.
  // `ready` en las dependencias (ver arriba): la primera tarjeta ya está
  // activa antes de que el mapa cargue, así que sin esto el paneo inicial se
  // perdía y el mapa se quedaba mostrando la zona del usuario en vez de la
  // dirección del turno — justo el síntoma reportado ("deberían pinearte y
  // dirigirte directamente a la dirección, no mostrar una zona que ya no
  // estás"). `zoom: 15` para que el paneo ACERQUE a la dirección: sin fijar
  // zoom, `easeTo` conserva el que hubiera, que tras el vuelo inicial es una
  // vista de barrio donde el pin queda perdido.
  //
  // Sólo con `followActive`: si corría también al abrir, la cámara volaba a
  // la persona y enseguida saltaba a la primera tarjeta, así que el mapa
  // mostraba siempre la zona de ese turno y no dónde estaba la persona
  // (auditoría de interfaz 2026-10-11, B02).
  useEffect(() => {
    if (!followActive || !mapRef.current || activeLat == null || activeLng == null) return;
    const options = { zoom: 15, duration: 450, bottomPadding: paddingRef.current };
    easeToPoint(mapRef.current, [activeLat, activeLng], options);
  }, [activeLat, activeLng, ready, followActive]);

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

  // Las pastillas con el nombre del local (zoom 15 o más). Se recalculan al
  // terminar de mover el mapa, igual que los clusters.
  const pastillas = useMemo(() => {
    if (!viewport || viewport.zoom < ZOOM_NOMBRES) return new Map();
    const pines: PinParaPastilla[] = [];
    for (const f of orderedClusters) {
      if (isCluster(f)) continue;
      const { shiftId, companyName, payLabel, isMatch } = f.properties;
      const [lng, lat] = f.geometry.coordinates;
      const { x, y } = proyectarEnEncuadre(viewport.bbox, viewport.ancho, viewport.alto, lng, lat);
      pines.push({ id: shiftId, nombre: companyName, x, y, pinAncho: anchoEstimadoPin(payLabel, isMatch) });
    }
    return colocarPastillas(pines, viewport.ancho, activeId);
  }, [orderedClusters, viewport, activeId]);

  const handleClusterClick = useCallback(
    (clusterId: number, lng: number, lat: number) => {
      if (!mapRef.current) return;
      const expansionZoom = Math.min(clusterIndex.getClusterExpansionZoom(clusterId), 18);
      const options = { zoom: expansionZoom, duration: 600, bottomPadding: paddingRef.current };
      easeToPoint(mapRef.current, [lat, lng], options);
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
      {!sinOrigen && <UserPuck center={center} />}
      {!sinOrigen && <RadiusRing center={center} radiusKm={SEARCH_RADIUS_KM} />}
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
        const { shiftId, position, urgent, payAmount, payLabel, isMatch, companyName } = feature.properties;
        return (
          <ShiftMarker
            key={shiftId}
            id={shiftId}
            longitude={lng}
            latitude={lat}
            position={position}
            payAmount={payAmount}
            payLabel={payLabel}
            urgent={urgent}
            isMatch={isMatch}
            active={shiftId === activeId}
            delayMs={index * 80}
            nombre={companyName}
            pastilla={pastillas.get(shiftId) ?? null}
            onClick={handleShiftSelect}
          />
        );
      })}
    </MapView>
  );
}
