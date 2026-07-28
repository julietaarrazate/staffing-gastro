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
  profile: WorkerProfile | null
): [number, number] | null {
  if (current) return [current.latitude, current.longitude];
  if (profile?.latitude != null && profile?.longitude != null) {
    return [profile.latitude, profile.longitude];
  }
  return null;
}

/**
 * Ordena los turnos del más cercano al más lejano. Los que no tienen
 * coordenadas van al final (no se los puede ubicar, pero tampoco se ocultan:
 * siguen siendo turnos válidos a los que alguien puede postularse).
 */
export function sortByDistance(shifts: Shift[], origin: [number, number] | null): Shift[] {
  if (!origin) return shifts;
  return [...shifts].sort((a, b) => {
    const da = distanceOf(a, origin);
    const db = distanceOf(b, origin);
    if (da === null) return db === null ? 0 : 1;
    if (db === null) return -1;
    return da - db;
  });
}

/** Distancia de un turno al origen, o `null` si el turno no tiene ubicación. */
export function distanceOf(shift: Shift, origin: [number, number] | null): number | null {
  if (!origin || shift.latitude == null || shift.longitude == null) return null;
  return haversineKm(origin, [shift.latitude, shift.longitude]);
}
