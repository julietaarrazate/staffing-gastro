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

export interface BottomPaddingApplier {
  /** Pide el padding inferior: en el momento si el mapa está quieto; si no, al `moveend`. */
  apply(bottom: number): void;
  /** Cancela el listener pendiente (cleanup al desmontar). */
  cancel(): void;
}

/**
 * Aplica el padding inferior de la hoja sin cortar nada. En MapLibre `jumpTo`
 * (y cualquier `easeTo`) detiene el vuelo o el gesto en curso, y su `moveend`
 * síncrono es una carrera para quien lleve estado de vuelos. Por eso: con el
 * mapa quieto se salta en el momento; con el mapa en movimiento se guarda el
 * ÚLTIMO valor pedido y se aplica al `moveend`, con un solo listener a la vez.
 * Los vuelos programáticos ya llevan el padding vigente en sus opciones.
 */
export function createBottomPaddingApplier(map: MapRef): BottomPaddingApplier {
  let pending: number | null = null;
  let listening = false;

  const jump = (bottom: number) =>
    map.jumpTo({ padding: { top: 0, left: 0, right: 0, bottom } });

  const arm = () => {
    if (listening) return;
    listening = true;
    map.once("moveend", flush);
  };

  // El `jumpTo` de acá dispara su propio `moveend`, pero el listener ya se
  // consumió (`once`) y `listening` está en false: no entra en bucle.
  function flush() {
    listening = false;
    if (pending == null) return;
    if (map.isMoving()) {
      arm();
      return;
    }
    const bottom = pending;
    pending = null;
    jump(bottom);
  }

  return {
    apply(bottom) {
      pending = bottom;
      if (map.isMoving()) {
        arm();
        return;
      }
      pending = null;
      jump(bottom);
    },
    cancel() {
      if (listening) map.off("moveend", flush);
      listening = false;
      pending = null;
    },
  };
}
