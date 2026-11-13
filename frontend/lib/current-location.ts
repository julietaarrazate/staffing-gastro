import { getCurrentPosition } from "@/lib/geolocation";
import { haversineKm } from "@/lib/map/geo";
import type { Shift, WorkerProfile } from "@/lib/types";

/**
 * "Estoy acá ahora": desde dónde se miden las distancias del feed.
 *
 * El diseño anterior asumía que **trabajás donde vivís**: la única ubicación
 * del trabajador era la fija de su perfil (la que elige en el onboarding), y
 * cualquier turno se medía desde ahí para siempre. Eso rompe en el caso más
 * común de un marketplace en tiempo real: vivís en Palermo, ahora estás en
 * Retiro, y un turno en Retiro te queda "lejos" según el sistema.
 *
 * A propósito NO hay seguimiento en segundo plano: gasta batería, exige
 * permisos que mucha gente niega y en una PWA no funciona con la app cerrada.
 * Acá la ubicación se toma **sólo cuando el trabajador la pide**, dura lo que
 * dura la pestaña (`sessionStorage`) y **no pisa la zona del perfil**, que
 * sigue siendo la base para decidir a quién avisarle de un turno nuevo.
 */

const KEY = "staffya_current_location";

export interface CurrentLocation {
  latitude: number;
  longitude: number;
  /** Momento en que se tomó, para poder mostrar "hace un rato". */
  takenAt: number;
}

export function getStoredLocation(): CurrentLocation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CurrentLocation) : null;
  } catch {
    return null;
  }
}

/** Pide el GPS del dispositivo y lo deja guardado para esta pestaña. */
export async function captureCurrentLocation(): Promise<CurrentLocation> {
  const { latitude, longitude } = await getCurrentPosition();
  const location: CurrentLocation = { latitude, longitude, takenAt: Date.now() };
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(location));
  } catch {
    // Modo privado o storage lleno: la ubicación igual sirve en memoria.
  }
  return location;
}

export function clearStoredLocation(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // No hay nada que limpiar.
  }
}

/**
 * Punto desde el que se miden las distancias: el "estoy acá" si el trabajador
 * lo pidió, y si no la zona de su perfil. `null` si no hay ninguno (perfil sin
 * coordenadas y sin ubicación tomada) — ahí no se puede ordenar por cercanía.
 */
export function originFor(
  current: CurrentLocation | null,
  profile: Pick<WorkerProfile, "latitude" | "longitude"> | null
): [number, number] | null {
  if (current) return [current.latitude, current.longitude];
  if (profile?.latitude != null && profile?.longitude != null) {
    return [profile.latitude, profile.longitude];
  }
  return null;
}

/**
 * Ordena los turnos del más cercano al más lejano, respetando primero los
 * urgentes.
 *
 * El backend ya devuelve el feed con `urgent` primero
 * (`ShiftRepository.list_open`, `ORDER BY urgent DESC, created_at DESC`),
 * pero un reorder por distancia que no tuviera en cuenta esa prioridad la
 * pisaba en silencio — un turno urgente lejos terminaba varias tarjetas
 * después de uno común y cercano (F1, auditoría de producto 2026-08-10).
 * Acá se ordena primero por urgencia y sólo entre turnos de la misma
 * urgencia se desempata por distancia, para no perder ninguna de las dos
 * señales. Los que no tienen coordenadas van al final de su grupo (no se
 * los puede ubicar, pero tampoco se ocultan).
 */
export function sortByDistance(shifts: Shift[], origin: [number, number] | null): Shift[] {
  return [...shifts].sort((a, b) => {
    if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
    if (!origin) return 0;
    const da = distanceOf(a, origin);
    const db = distanceOf(b, origin);
    if (da === null) return db === null ? 0 : 1;
    if (db === null) return -1;
    return da - db;
  });
}

/**
 * Hasta dónde llega «cerca» en el Inicio, en km. Es el mismo radio con el que
 * el servidor arma el feed (`FEED_RADIUS_KM` en
 * `backend/app/modules/shift/application/services.py`, el de la escalada de
 * un turno urgente): si cambia uno, cambia el otro.
 */
export const NEARBY_RADIUS_KM = 40;

/**
 * Deja sólo los turnos que están cerca del origen. «Cerca tuyo» no puede
 * mostrar un turno de otra provincia.
 *
 * El servidor ya devuelve el feed acotado a la zona del perfil. Este corte es
 * el del lado de la pantalla, que es la única que sabe desde dónde se está
 * midiendo: si el trabajador tocó "Estoy acá", el origen es ese punto (que no
 * sale del dispositivo) y no la zona del perfil.
 *
 * Sin origen no hay con qué medir y no se saca nada. Un turno sin coordenadas
 * se queda por defecto (el servidor lo incluyó porque es de la misma ciudad);
 * con `keepUnlocated: false` se va, para cuando se pidió un radio puntual.
 */
export function nearbyOnly(
  shifts: Shift[],
  origin: [number, number] | null,
  radiusKm: number = NEARBY_RADIUS_KM,
  { keepUnlocated = true }: { keepUnlocated?: boolean } = {}
): Shift[] {
  if (!origin) return shifts;
  return shifts.filter((shift) => {
    const distance = distanceOf(shift, origin);
    return distance === null ? keepUnlocated : distance <= radiusKm;
  });
}

/** Distancia de un turno al origen, o `null` si el turno no tiene ubicación. */
export function distanceOf(shift: Shift, origin: [number, number] | null): number | null {
  if (!origin || shift.latitude == null || shift.longitude == null) return null;
  return haversineKm(origin, [shift.latitude, shift.longitude]);
}
