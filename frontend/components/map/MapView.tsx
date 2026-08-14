"use client";

// Único punto de importación del CSS de MapLibre (doc §4.6: "un solo
// contexto WebGL reutilizado... CSS de maplibre importado una vez").
import "maplibre-gl/dist/maplibre-gl.css";

import { forwardRef, useImperativeHandle, useRef, type ReactNode } from "react";
import {
  AttributionControl,
  Map as MapGl,
  type MapEvent,
  type MapRef,
  type ViewStateChangeEvent,
} from "@vis.gl/react-maplibre";
import { MAP_STYLE_URL } from "@/lib/map/style";

export interface MapViewProps {
  /** Centro inicial `[lat, lng]`. Vista no controlada: sólo se usa al montar. */
  center: [number, number];
  zoom?: number;
  children?: ReactNode;
  onLoad?: (map: MapRef) => void;
  onMoveEnd?: (event: ViewStateChangeEvent) => void;
  className?: string;
  /** `false` desactiva todo gesto (pan/zoom/rotate) — thumbnails estáticos como `MiniMap`. */
  interactive?: boolean;
  /** `false` oculta el control de atribución compacto (miniaturas chicas). */
  attribution?: boolean;
  /**
   * `true` exige dos dedos para arrastrar/rotar el mapa (un dedo hace scroll
   * de la página en vez de panear) y Ctrl/Cmd+scroll para hacer zoom en
   * desktop — feature nativa de MapLibre pensada justo para mapas EMBEBIDOS
   * dentro de una página con scroll (`MapAddressPicker`, adentro de un
   * formulario largo): sin esto, arrastrar un dedo sobre el mapa para seguir
   * bajando la página lo mueve a él en cambio, atrapando el scroll (reporte
   * real de Julieta, 2026-08-09). NO usar en mapas de pantalla completa
   * (`/map`, `/search`) — ahí el paneo de un dedo es el gesto esperado, no
   * hay scroll de página con el que competir.
   */
  cooperativeGestures?: boolean;
}

/**
 * Mapa base vectorial del módulo `components/map/`: ninguna otra pantalla
 * importa `maplibre-gl` directamente (ver docs/reference/MAPS_REDESIGN.md §4.1 y
 * ADR-0001). Estilo CARTO Voyager GL, atribución compacta, sin logo.
 */
// Handlers de gesto de maplibre-gl que la opción `interactive` del
// constructor enciende/apaga en bloque (ver maplibre-gl `Map#_setupHandlers`).
// El wrapper `@vis.gl/react-maplibre` sólo vuelve a llamar `.enable()`/
// `.disable()` sobre estos handlers cuando cambia un prop *puntual* (p. ej.
// `dragPan`), nunca por un cambio en `interactive` — y con `reuseMaps` el
// mismo `mapboxgl.Map` (WebGL/canvas) subyacente se recicla entre montajes
// no relacionados vía un pool ESTÁTICO de la librería (`Maplibre.savedMaps`,
// compartido por todos los `MapView` de la app, sin distinguir cuál era
// interactivo). Resultado: si primero se desmonta un mapa `interactive={false}`
// (p. ej. el thumbnail de `MiniMap` en una tarjeta de turno) y después se
// monta uno `interactive` (p. ej. `/map`), éste reutiliza el `Map` con los
// gestos ya deshabilitados desde su construcción original y queda "trabado"
// hasta refrescar la página (que vacía el pool). Forzamos acá el estado real
// de los handlers en cada `load` (se dispara también en el reuse simulado)
// para que nunca dependa de qué instancia haya reciclado el pool.
const GESTURE_HANDLERS = [
  "scrollZoom",
  "boxZoom",
  "dragRotate",
  "dragPan",
  "keyboard",
  "doubleClickZoom",
  "touchZoomRotate",
  "touchPitch",
] as const;

export function syncInteractiveHandlers(raw: unknown, interactive: boolean) {
  for (const name of GESTURE_HANDLERS) {
    const handler = (raw as Record<string, { enable(): void; disable(): void } | undefined>)[name];
    if (!handler) continue;
    if (interactive) handler.enable();
    else handler.disable();
  }
}

// Mismo problema que arriba, pero con `cooperativeGestures` — el gesto que
// exige dos dedos para panear un mapa embebido en una página con scroll
// (reporte real de Julieta, ver el prop más abajo). `cooperativeGestures` es
// una opción de CONSTRUCTOR: maplibre-gl la usa una sola vez para armar
// `map.cooperativeGestures` (un handler más, con su propio `.enable()`/
// `.disable()`) y después no vuelve a mirar la prop — ni la librería base ni
// el wrapper la re-sincronizan en `setProps`/`reuse` (no está en su lista de
// handlers togglables). Con `reuseMaps`, si el mapa reciclado se construyó
// SIN `cooperativeGestures` (p. ej. porque el usuario visitó antes `/map` o
// `/search`, pantalla completa, sin esta opción) y ahora se monta uno que sí
// la pide (`MapAddressPicker`, adentro de un formulario con scroll), el
// mapa reciclado queda con la protección apagada aunque el prop diga
// `true` — un dedo vuelve a panear el mapa en vez de scrollear la página.
// Mismo mecanismo de sincronización manual en cada `load` que `interactive`.
export function syncCooperativeGestures(raw: unknown, cooperativeGestures: boolean) {
  const handler = (raw as { cooperativeGestures?: { enable(): void; disable(): void } })
    .cooperativeGestures;
  if (!handler) return;
  if (cooperativeGestures) handler.enable();
  else handler.disable();
}

const MapView = forwardRef<MapRef, MapViewProps>(function MapView(
  {
    center,
    zoom = 14,
    children,
    onLoad,
    onMoveEnd,
    className,
    interactive = true,
    attribution = true,
    cooperativeGestures = false,
  },
  forwardedRef
) {
  const mapRef = useRef<MapRef>(null);
  useImperativeHandle(forwardedRef, () => mapRef.current as MapRef, []);

  return (
    <div className={className}>
      <MapGl
        ref={mapRef}
        reuseMaps
        interactive={interactive}
        cooperativeGestures={cooperativeGestures}
        initialViewState={{ longitude: center[1], latitude: center[0], zoom }}
        mapStyle={MAP_STYLE_URL}
        attributionControl={false}
        style={{ width: "100%", height: "100%" }}
        onLoad={(e: MapEvent) => {
          // En un mapa reciclado (`reuseMaps`) este evento se dispara de forma
          // SÍNCRONA dentro de `Maplibre.reuse()` (maplibre/maplibre.js) si el
          // estilo ya estaba cargado de un montaje anterior — antes de que
          // React actualice `mapRef.current` vía `useImperativeHandle`. Por
          // eso usamos `e.target` (el `mapboxgl.Map` real, disponible ya) en
          // vez de `mapRef.current` para sincronizar los handlers.
          syncInteractiveHandlers(e.target, interactive);
          syncCooperativeGestures(e.target, cooperativeGestures);
          if (mapRef.current) onLoad?.(mapRef.current);
        }}
        onMoveEnd={onMoveEnd}
      >
        {attribution && <AttributionControl compact position="bottom-right" />}
        {children}
      </MapGl>
    </div>
  );
});

export default MapView;
