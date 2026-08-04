/**
 * Tiempos estimados por modo de transporte (docs/reference/MAPS_REDESIGN.md §4.3).
 * Heurística urbana honesta, etiquetada "aprox." en la UI hasta que exista
 * routing real (F4, provider OSRM en `lib/map/routing.ts`).
 *
 * Se parte de la distancia Haversine (línea recta) y se aplica un factor de
 * red vial (calles, cuadras, curvas) para acercarla a una distancia real de
 * trayecto. Velocidades promedio urbanas (CABA):
 * - Caminando: 4.5 km/h
 * - Bici: 12 km/h
 * - Auto: 18 km/h (tránsito urbano, no autopista)
 */

/** Factor de red vial: una distancia real de trayecto es ~1.3x la línea recta. */
const ROAD_NETWORK_FACTOR = 1.3;

const WALK_SPEED_KMH = 4.5;
const BIKE_SPEED_KMH = 12;
const CAR_SPEED_KMH = 18;

export interface TravelTimes {
  walkMin: number;
  bikeMin: number;
  carMin: number;
}

/** Minutos redondeados (mínimo 1) para recorrer `distanceKm` a `speedKmh`. */
function minutesFor(distanceKm: number, speedKmh: number): number {
  const minutes = (distanceKm / speedKmh) * 60;
  return Math.max(1, Math.round(minutes));
}

/**
 * Estima los tiempos de viaje por modo a partir de la distancia en línea
 * recta (Haversine) entre origen y destino, ver `lib/map/geo.ts`.
 */
export function estimateTravelTimes(distanceKm: number): TravelTimes {
  const roadDistanceKm = distanceKm * ROAD_NETWORK_FACTOR;
  return {
    walkMin: minutesFor(roadDistanceKm, WALK_SPEED_KMH),
    bikeMin: minutesFor(roadDistanceKm, BIKE_SPEED_KMH),
    carMin: minutesFor(roadDistanceKm, CAR_SPEED_KMH),
  };
}
