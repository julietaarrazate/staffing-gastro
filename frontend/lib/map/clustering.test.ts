import { describe, expect, it } from "vitest";
import type { Shift } from "@/lib/types";
import { buildShiftClusterIndex, isCluster } from "./clustering";

// Tres turnos a ~50-100 m entre sí en Palermo y uno lejos (Córdoba).
function turno(id: string, latitude: number, longitude: number): Shift {
  return {
    id,
    urgent: false,
    position: "mozo",
    pay_amount: "20000",
    pay_band: null,
    latitude,
    longitude,
  } as unknown as Shift;
}

const shifts: Shift[] = [
  turno("a", -34.5880, -58.4300),
  turno("b", -34.5884, -58.4305),
  turno("c", -34.5877, -58.4309),
  turno("lejos", -31.4201, -64.1888),
  // Sin coordenadas: se descarta, no rompe el índice.
  { ...turno("sin-coords", 0, 0), latitude: null, longitude: null } as unknown as Shift,
];

const MUNDO: [number, number, number, number] = [-180, -85, 180, 85];

describe("buildShiftClusterIndex", () => {
  it("agrupa los turnos cercanos en un zoom bajo", () => {
    const features = buildShiftClusterIndex(shifts).getClusters(MUNDO, 10);
    const clusters = features.filter(isCluster);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].properties.point_count).toBe(3);
    // El lejano queda como punto suelto.
    const sueltos = features.filter((f) => !isCluster(f));
    expect(sueltos.map((f) => (f.properties as { shiftId: string }).shiftId)).toEqual(["lejos"]);
  });

  it("separa los turnos en un zoom alto", () => {
    const features = buildShiftClusterIndex(shifts).getClusters(MUNDO, 18);
    expect(features.filter(isCluster)).toHaveLength(0);
    const ids = features.map((f) => (f.properties as { shiftId: string }).shiftId).sort();
    expect(ids).toEqual(["a", "b", "c", "lejos"]);
  });

  it("el zoom de expansión de un cluster lo abre en sus turnos", () => {
    const index = buildShiftClusterIndex(shifts);
    const [cluster] = index.getClusters(MUNDO, 10).filter(isCluster);
    const zoom = index.getClusterExpansionZoom(cluster.properties.cluster_id);
    expect(zoom).toBeGreaterThan(10);
    expect(index.getLeaves(cluster.properties.cluster_id)).toHaveLength(3);
  });
});
