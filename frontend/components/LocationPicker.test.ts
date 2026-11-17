import { describe, expect, it } from "vitest";
import { nearestLocality, parseSavedCity } from "./LocationPicker";
import { PROVINCES } from "@/lib/locations";

describe("parseSavedCity", () => {
  it("reconoce una zona guardada de CABA", () => {
    const r = parseSavedCity("Palermo, CABA");
    expect(r).not.toBeNull();
    expect(r!.localityName).toBe("Palermo");
    expect(PROVINCES[r!.provinceIdx].name).toMatch(/^Ciudad Autónoma/);
  });
  it("devuelve null con «Mi ubicación actual», vacío o zona desconocida", () => {
    expect(parseSavedCity("Mi ubicación actual")).toBeNull();
    expect(parseSavedCity("")).toBeNull();
    expect(parseSavedCity(null)).toBeNull();
    expect(parseSavedCity("Narnia, CABA")).toBeNull();
  });
});

describe("nearestLocality", () => {
  it("nombra el barrio más cercano al GPS", () => {
    expect(nearestLocality(-34.5875, -58.4538)?.localityName).toBe("Chacarita");
  });
  it("no inventa nombre lejos de toda localidad", () => {
    expect(nearestLocality(-10, -40)).toBeNull();
  });
});
