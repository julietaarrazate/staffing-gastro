import { describe, expect, it } from "vitest";
import type { Shift } from "@/lib/types";
import { NEARBY_RADIUS_KM, nearbyOnly, sortByDistance } from "./current-location";

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

describe("nearbyOnly", () => {
  const CORDOBA: [number, number] = [-31.4201, -64.1888]; // a ~650 km de Palermo
  // Un grado de latitud son ~111 km.
  const northOf = (km: number): [number, number] => [ORIGIN[0] + km / 111.19, ORIGIN[1]];

  it("«Cerca tuyo» no muestra un turno de otra provincia", () => {
    const cerca = shift("cerca", false, -34.588, -58.426);
    const otraProvincia = shift("cordoba", true, CORDOBA[0], CORDOBA[1]);

    expect(nearbyOnly([otraProvincia, cerca], ORIGIN).map((s) => s.id)).toEqual(["cerca"]);
  });

  it("el radio por defecto es el del feed: 40 km, con el borde adentro", () => {
    expect(NEARBY_RADIUS_KM).toBe(40);
    const adentro = shift("a-39", false, ...northOf(39));
    const afuera = shift("a-41", false, ...northOf(41));

    expect(nearbyOnly([adentro, afuera], ORIGIN).map((s) => s.id)).toEqual(["a-39"]);
  });

  it("con un radio pedido (búsqueda del asistente) corta en ese radio", () => {
    const a1 = shift("a-1", false, ...northOf(1));
    const a5 = shift("a-5", false, ...northOf(5));

    expect(nearbyOnly([a1, a5], ORIGIN, 2).map((s) => s.id)).toEqual(["a-1"]);
  });

  it("sin origen no hay con qué medir: no saca nada", () => {
    const lejos = shift("lejos", false, CORDOBA[0], CORDOBA[1]);
    expect(nearbyOnly([lejos], null)).toEqual([lejos]);
  });

  it("un turno sin coordenadas se queda, salvo que se pida lo contrario", () => {
    const sinUbicacion = shift("sin-ubicacion", false, null, null);

    expect(nearbyOnly([sinUbicacion], ORIGIN)).toEqual([sinUbicacion]);
    expect(nearbyOnly([sinUbicacion], ORIGIN, 2, { keepUnlocated: false })).toEqual([]);
  });

  it("no cambia el orden de lo que queda", () => {
    const b = shift("b", false, ...northOf(3));
    const a = shift("a", true, ...northOf(8));

    expect(nearbyOnly([b, a], ORIGIN).map((s) => s.id)).toEqual(["b", "a"]);
  });
});
