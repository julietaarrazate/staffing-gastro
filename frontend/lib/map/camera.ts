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
}

/** Vuelo largo con curva (apertura de pantalla, "centrarme"). */
export function flyToPoint(
  map: MapRef | null | undefined,
  center: [number, number],
  { zoom, duration = 1400 }: CameraOptions = {}
): void {
  if (!map) return;
  map.flyTo({
    center: [center[1], center[0]],
    zoom,
    duration: prefersReducedMotion() ? 0 : duration,
    curve: 1.42,
    essential: true,
  });
}

/** Paneo corto y suave (seguir la tarjeta activa del carrusel, expandir cluster). */
export function easeToPoint(
  map: MapRef | null | undefined,
  center: [number, number],
  { zoom, duration = 500 }: CameraOptions = {}
): void {
  if (!map) return;
  map.easeTo({
    center: [center[1], center[0]],
    zoom,
    duration: prefersReducedMotion() ? 0 : duration,
    essential: true,
  });
}
