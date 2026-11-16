import type { MapRef } from "@vis.gl/react-maplibre";

/**
 * Helpers de cámara sobre la instancia real de MapLibre (`flyTo`/`easeTo`),
 * únicas rutas por las que el módulo de mapa mueve la vista. Respetan
 * `prefers-reduced-motion` (duración 0 = salto directo, sin curva).
 */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

interface CameraOptions {
  zoom?: number;
  duration?: number;
  /** Padding inferior (px) con el que termina el vuelo: el de la hoja vigente. */
  bottomPadding?: number;
}

function paddingOpt(bottom: number | undefined) {
  return bottom == null ? {} : { padding: { top: 0, left: 0, right: 0, bottom } };
}

/** Vuelo largo con curva (apertura de pantalla, "centrarme"). */
export function flyToPoint(
  map: MapRef | null | undefined,
  center: [number, number],
  { zoom, duration = 1400, bottomPadding }: CameraOptions = {}
): void {
  if (!map) return;
  map.flyTo({
    center: [center[1], center[0]],
    zoom,
    ...paddingOpt(bottomPadding),
    duration: prefersReducedMotion() ? 0 : duration,
    curve: 1.42,
    essential: true,
  });
}

/** Paneo corto y suave (seguir la tarjeta activa del carrusel, expandir cluster). */
export function easeToPoint(
  map: MapRef | null | undefined,
  center: [number, number],
  { zoom, duration = 500, bottomPadding }: CameraOptions = {}
): void {
  if (!map) return;
  map.easeTo({
    center: [center[1], center[0]],
    zoom,
    ...paddingOpt(bottomPadding),
    duration: prefersReducedMotion() ? 0 : duration,
    essential: true,
  });
}

/**
 * Padding inferior de la cámara para que la hoja de tarjetas (mobile) no tape
 * lo que el mapa encuadra. Con `padding.bottom` MapLibre mueve el "centro
 * visual" al medio de la parte libre: `flyTo`/`easeTo` a un punto lo dejan
 * arriba de la hoja y no justo debajo de su borde.
 *
 * Es el alto visible de la hoja (`containerHeight * fraccion`), con un tope
 * (`maxFraction` del contenedor) para que, con la hoja casi a pantalla
 * completa, el encuadre no quede en una franja diminuta. 0 si no hay hoja
 * (desktop, sin turnos) o si todavía no se midió el contenedor.
 */
export function sheetBottomPadding(
  containerHeight: number,
  sheetFraction: number,
  maxFraction = 0.55
): number {
  if (!(containerHeight > 0) || !(sheetFraction > 0)) return 0;
  const fraction = Math.min(sheetFraction, maxFraction);
  return Math.round(containerHeight * fraction);
}

/** Último vuelo pedido a la cámara, para reanudarlo si el padding lo corta. */
export interface LastFlight {
  kind: "fly" | "ease";
  center: [number, number];
  options: CameraOptions;
}

/**
 * Aplica el padding inferior sin animar. En MapLibre `jumpTo` (y cualquier
 * `easeTo`, aun con duración 0) corta el vuelo en curso, y sin `center` el
 * destino pasaría a ser el centro actual: el vuelo no llegaría a su turno. Por
 * eso, si el mapa se estaba moviendo, se reanuda el último vuelo hacia el MISMO
 * destino y con el padding nuevo (los vuelos nuevos ya salen con el vigente).
 */
export function applyBottomPadding(
  map: MapRef | null | undefined,
  bottom: number,
  lastFlight?: LastFlight | null
): void {
  if (!map) return;
  const moving = map.isMoving();
  map.jumpTo({ padding: { top: 0, left: 0, right: 0, bottom } });
  if (!moving || !lastFlight) return;
  const options = { ...lastFlight.options, bottomPadding: bottom };
  if (lastFlight.kind === "fly") flyToPoint(map, lastFlight.center, options);
  else easeToPoint(map, lastFlight.center, options);
}
