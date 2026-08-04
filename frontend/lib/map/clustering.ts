import Supercluster from "supercluster";
import type { Shift, WorkerSkill } from "@/lib/types";

/**
 * Clustering de turnos con `supercluster` sobre la fuente de puntos visible.
 * Elegido en vez del clustering nativo de `<Source cluster>` porque acá los
 * marcadores son componentes DOM de React (con animaciones/identidad por
 * rubro), no una capa `circle` de MapLibre: necesitamos los clusters como
 * objetos JS para decidir qué renderizar (`ShiftMarker` vs `ClusterMarker`),
 * no como capas de estilo. Ver ADR-0001 y docs/reference/MAPS_REDESIGN.md §4.1.
 */
const CLUSTER_RADIUS_PX = 52;
const CLUSTER_MAX_ZOOM = 17;

export interface ShiftPointProps {
  shiftId: string;
  urgent: boolean;
  position: WorkerSkill;
}

type ShiftWithCoords = Shift & { latitude: number; longitude: number };

// No usamos `map`/`reduce` de supercluster: los clusters no agregan
// propiedades de turno (rubro/urgente), sólo el conteo. Segundo genérico de
// `Supercluster` (propiedades de cluster) queda vacío para reflejar eso.
export type ShiftGeoPoint = Supercluster.PointFeature<ShiftPointProps>;
export type ShiftClusterOnly = Supercluster.ClusterFeature<Record<string, never>>;
export type ShiftClusterFeature = ShiftClusterOnly | ShiftGeoPoint;

/** Type guard: distingue un cluster de un punto individual. */
export function isCluster(feature: ShiftClusterFeature): feature is ShiftClusterOnly {
  return (feature.properties as { cluster?: boolean }).cluster === true;
}

export function buildShiftClusterIndex(
  shifts: Shift[]
): Supercluster<ShiftPointProps, Record<string, never>> {
  const points: ShiftGeoPoint[] = shifts
    .filter((s): s is ShiftWithCoords => s.latitude != null && s.longitude != null)
    .map((s) => ({
      type: "Feature",
      properties: { shiftId: s.id, urgent: s.urgent, position: s.position },
      geometry: { type: "Point", coordinates: [s.longitude, s.latitude] },
    }));
  const index = new Supercluster<ShiftPointProps, Record<string, never>>({
    radius: CLUSTER_RADIUS_PX,
    maxZoom: CLUSTER_MAX_ZOOM,
  });
  index.load(points);
  return index;
}
