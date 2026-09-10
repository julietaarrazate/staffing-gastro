"use client";

// Único punto de importación del CSS de MapLibre (doc §4.6: "un solo
// contexto WebGL reutilizado... CSS de maplibre importado una vez").
import "maplibre-gl/dist/maplibre-gl.css";
// Efecto de módulo, y por eso va acá: `MapView` es el ÚNICO punto de la app
// que construye mapas, así que importarlo acá garantiza que `WORKER_URL` esté
// puesto antes del primer `new Map()`. Sin esto el mapa queda en blanco, sin
// marcadores y sin error en consola — ver lib/map/worker.ts.
import "@/lib/map/worker";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AttributionControl,
  Map as MapGl,
  type MapEvent,
  type MapRef,
  type ViewStateChangeEvent,
} from "@vis.gl/react-maplibre";
import { MAP_STYLE_URL } from "@/lib/map/style";

export interface MapViewProps {
  /**
   * Centro `[lat, lng]`. La vista sigue siendo no controlada (mover el mapa
   * con el dedo no avisa hacia arriba), pero este valor SÍ se aplica en cada
   * `load` —incluido el `load` sintético de un mapa reciclado— vía
   * `syncCamera`: sin eso, un mapa del pool abre con la cámara del montaje
   * anterior. Para mover la vista después del `load`, usar los helpers de
   * `lib/map/camera` (`flyToPoint`/`easeToPoint`) como hace `ShiftMap`.
   */
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

// Tercer efecto del mismo `reuseMaps`, y el más visible de los tres para el
// usuario: la CÁMARA. `initialViewState` es —como su nombre dice— sólo
// inicial: maplibre-gl la aplica al construir el `Map` y nunca más. Con el
// pool estático de la librería, un mapa reciclado llega con el centro/zoom
// del montaje ANTERIOR y `initialViewState` no vuelve a correr, así que la
// pantalla nueva muestra la vista de la vieja. Se ve en todos lados:
//   - `/map` y `/search` abren en el centro por defecto (Obelisco) aunque la
//     geolocalización ya haya resuelto (reporte repetido de Julieta:
//     "sigue sin apuntar a la geolocalización en la que estoy");
//   - el mini-mapa de una tarjeta de turno (`MiniMap`) muestra la zona del
//     turno anterior en vez de la del suyo ("en mapa de turno también tiene
//     que apuntar a la zona que muestra el turno").
// Además cierra una carrera real independiente del reuse: si la
// geolocalización resuelve ANTES de que el mapa termine de cargar, el
// `flyTo` que hace `ShiftMap` al cambiar `center` se ejecuta con
// `mapRef.current` todavía en `null` y se pierde para siempre (su efecto no
// vuelve a correr porque `center` ya no cambia). Al saltar acá, en `load`,
// leemos el `center` VIGENTE en ese momento y la vista queda bien igual.
export function syncCamera(raw: unknown, center: [number, number], zoom: number) {
  const map = raw as {
    jumpTo?(opts: { center: [number, number]; zoom: number }): void;
  };
  map.jumpTo?.({ center: [center[1], center[0]], zoom });
}

// Margen antes de dar la carga por perdida. Un mapa vectorial sobre 3G en la
// calle tarda; 15s es holgado para eso y sigue siendo mucho menos que el
// "para siempre" que había antes.
const TIMEOUT_CARGA_MS = 15_000;

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

  // Los hijos se montan DESPUÉS del `load`, nunca antes. Un `Source`/`Layer`
  // agregado mientras el estilo todavía está cargando deja a maplibre 6 con
  // `isStyleLoaded()` en `false` PARA SIEMPRE: el evento `load` no llega a
  // dispararse nunca (verificado: no llega ni a los 60s), y como todo lo que
  // cuelga de él —el viewport inicial de `ShiftMap`, y con él los marcadores
  // de turno— espera ese evento, el mapa queda dibujado pero vacío, sin un
  // solo error en consola. maplibre 5 lo toleraba; el 6 no.
  // Se resuelve acá y no en cada pantalla a propósito: `RadiusRing` (`/map`)
  // y `EnRouteMap` ya montaban capas de entrada, y el próximo que agregue una
  // no tiene forma de enterarse de la regla — el fallo es silencioso. Los
  // `Marker` son overlays de DOM y no tocan el estilo, así que retrasarlos
  // hasta el `load` (~600ms) no cambia nada visible.
  const [loaded, setLoaded] = useState(false);

  // Contrapeso del gate de arriba. El gate es correcto, pero convierte
  // CUALQUIER falla de carga en una pantalla en blanco perfecta: sin fondo,
  // sin pines y sin un solo mensaje. Le pasó a Julieta con el worker roto de
  // maplibre 6 ("no se ve el mapa ni en comercio ni en trabajador") y volvería
  // a pasar si mañana CARTO se cae, si la red del usuario bloquea el CDN o si
  // el worker no llega a estar donde `WORKER_URL` dice.
  //
  // Un mapa que no carga es un problema; un mapa que no carga y no lo dice es
  // un bug invisible que tarda semanas en llegar como reporte. Se le da un
  // margen generoso (una conexión mala en la calle es el caso normal de esta
  // app) y recién ahí se ofrece reintentar.
  const [falloCarga, setFalloCarga] = useState(false);
  // Cambiarlo fuerza a React a descartar el `Map` actual y construir uno nuevo:
  // reintentar sobre la misma instancia no sirve, el estilo ya falló en ella.
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (loaded) return;
    const id = setTimeout(() => setFalloCarga(true), TIMEOUT_CARGA_MS);
    return () => clearTimeout(id);
  }, [loaded, intento]);

  return (
    <div className={className}>
      {/* Caja posicionada propia para el aviso de error de abajo. Va acá
          adentro y no como `relative` en el div de arriba a propósito: varias
          pantallas pasan `absolute inset-0` en `className` y `relative` es la
          MISMA propiedad CSS — cuál gana lo decide el orden del CSS generado
          por Tailwind, no el orden en el atributo, así que agregarlo ahí era
          jugarse el posicionamiento del mapa a pantalla completa. */}
      <div className="relative h-full w-full">
        <MapGl
          key={intento}
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
            syncCamera(e.target, center, zoom);
            setLoaded(true);
            setFalloCarga(false);
            if (mapRef.current) onLoad?.(mapRef.current);
          }}
          onMoveEnd={onMoveEnd}
        >
          {attribution && <AttributionControl compact position="bottom-right" />}
          {loaded && children}
        </MapGl>
        {falloCarga && !loaded && (
          <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center gap-3 bg-surface p-6 text-center">
            <p className="text-sm font-semibold text-ink">No pudimos cargar el mapa</p>
            <p className="max-w-[28ch] text-sm text-ink/60">
              Puede ser la conexión. Los turnos siguen disponibles en la lista.
            </p>
            <button
              type="button"
              onClick={() => {
                setFalloCarga(false);
                setIntento((n) => n + 1);
              }}
              className="min-h-[44px] rounded-[var(--radius-input)] bg-ink px-5 text-sm font-semibold text-white active:scale-95"
            >
              Reintentar
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

export default MapView;
