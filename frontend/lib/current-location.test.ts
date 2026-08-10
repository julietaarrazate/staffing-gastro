import { describe, expect, it } from "vitest";
import type { Shift } from "@/lib/types";
import { sortByDistance } from "./current-location";

const ORIGIN: [number, number] = [-34.5875, -58.4257]; // Palermo

function shift(id: string, urgent: boolean, latitude: number | null, longitude: number | null): Shift {
  return { id, urgent, latitude, longitude } as Shift;
}

describe("sortByDistance", () => {
  it("un turno urgente lejos va antes que uno común y cercano (F1, no pierde la urgencia)", () => {
    const cercanoComun = shift("cerca", false, -34.588, -58.426); // a metros del origen
    const lejosUrgente = shift("lejos", true, -34.7, -58.5); // varios km

    const sorted = sortByDistance([cercanoComun, lejosUrgente], ORIGIN);
    expect(sorted.map((s) => s.id)).toEqual(["lejos", "cerca"]);
  });

  it("entre turnos de la misma urgencia, desempata por distancia", () => {
    const lejos = shift("lejos", true, -34.7, -58.5);
    const cerca = shift("cerca", true, -34.588, -58.426);

    const sorted = sortByDistance([lejos, cerca], ORIGIN);
    expect(sorted.map((s) => s.id)).toEqual(["cerca", "lejos"]);
  });

  it("sin origen, igual respeta la urgencia (no se puede ordenar por distancia)", () => {
    const comun = shift("comun", false, null, null);
    const urgente = shift("urgente", true, null, null);

    const sorted = sortByDistance([comun, urgente], null);
    expect(sorted.map((s) => s.id)).toEqual(["urgente", "comun"]);
  });

  it("sin coordenadas, un turno queda al final de su propio grupo de urgencia", () => {
    const sinUbicacion = shift("sin-ubicacion", false, null, null);
    const conUbicacion = shift("con-ubicacion", false, -34.6, -58.45);

    const sorted = sortByDistance([sinUbicacion, conUbicacion], ORIGIN);
    expect(sorted.map((s) => s.id)).toEqual(["con-ubicacion", "sin-ubicacion"]);
  });
});
