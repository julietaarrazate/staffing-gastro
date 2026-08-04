/**
 * Geometría del mapa: único lugar del front con Haversine y generación de
 * círculos geográficos (ver docs/reference/MAPS_REDESIGN.md §4.3 y §4.6 — antes había
 * un `haversineKm` duplicado en `app/map/page.tsx`).
 *
 * Convención de coordenadas: tuplas `[lat, lng]` (igual que el resto del
 * front y que `Shift.latitude/longitude`). Sólo al hablar con MapLibre/GeoJSON
 * se convierte a `[lng, lat]`.
 */

/** Distancia entre dos puntos en kilómetros (fórmula de Haversine). */
export function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Genera el anillo (polígono) de un círculo geográfico aproximado alrededor
 * de `center`, en coordenadas `[lng, lat]` listas para GeoJSON. Se usa para
 * `RadiusRing` como capa `fill`/`line`, que así escala solo con el zoom del
 * mapa (no hay que recalcular tamaños en píxeles a mano).
 */
export function circlePolygonCoordinates(
  center: [number, number],
  radiusKm: number,
  points = 64
): [number, number][] {
  const [lat, lng] = center;
  const distanceX = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const distanceY = radiusKm / 110.57;
  const coords: [number, number][] = [];
  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * 2 * Math.PI;
    coords.push([lng + distanceX * Math.cos(theta), lat + distanceY * Math.sin(theta)]);
  }
  return coords;
}
