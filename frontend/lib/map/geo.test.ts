import { describe, expect, it } from "vitest";
import { circlePolygonCoordinates, haversineKm } from "./geo";

describe("haversineKm", () => {
  it("es 0 para el mismo punto", () => {
    expect(haversineKm([-34.6037, -58.3816], [-34.6037, -58.3816])).toBe(0);
  });

  it("da ~111.19 km por cada grado de latitud (R * dLat en radianes)", () => {
    // Con dLng=0, la fórmula de Haversine se reduce a R*dLat exactamente
    // (asin(sin(x)) = x en el rango [-90°,90°]), así que es un valor
    // verificable a mano, no un número mágico.
    expect(haversineKm([0, 0], [1, 0])).toBeCloseTo(111.194926644, 6);
  });

  it("es simétrica (distancia A→B == B→A)", () => {
    const a: [number, number] = [-34.58, -58.43];
    const b: [number, number] = [-31.4, -64.2];
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 10);
  });
});

describe("circlePolygonCoordinates", () => {
  it("devuelve points+1 coordenadas (anillo cerrado: primer punto == último)", () => {
    const coords = circlePolygonCoordinates([-34.6, -58.4], 5, 8);
    expect(coords).toHaveLength(9);
    expect(coords[0][0]).toBeCloseTo(coords[8][0], 10);
    expect(coords[0][1]).toBeCloseTo(coords[8][1], 10);
  });

  it("en theta=0 el punto queda desplazado sólo en longitud (este del centro)", () => {
    const [lat, lng] = [-34.6, -58.4];
    const coords = circlePolygonCoordinates([lat, lng], 5, 4);
    const [firstLng, firstLat] = coords[0];
    expect(firstLat).toBeCloseTo(lat, 10);
    expect(firstLng).toBeGreaterThan(lng);
  });
});
