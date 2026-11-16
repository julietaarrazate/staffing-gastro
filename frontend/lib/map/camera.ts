import type { MapRef } from "@vis.gl/react-maplibre";
import { boundsOf } from "@/lib/map/geo";

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

/**
 * Encuadra todos los puntos `[lat, lng]` con margen (el marcador y su halo no
 * quedan cortados) y un zoom máximo (dos puntos casi juntos no acercan la
 * cámara hasta que el mapa deja de tener referencias). Sirve para mapas
 * chicos y no interactivos como `EnRouteMap`, donde nadie mueve la vista.
 */
export function fitPoints(
  map: MapRef | null | undefined,
  points: [number, number][],
  { padding = 32, maxZoom = 16, duration = 500 }: { padding?: number; maxZoom?: number; duration?: number } = {}
): void {
  if (!map || points.length === 0) return;
  map.fitBounds(boundsOf(points), {
    padding,
    maxZoom,
    duration: prefersReducedMotion() ? 0 : duration,
    essential: true,
  });
}
