import { describe, expect, it } from "vitest";
import { companyPlaceFromProfile } from "./company-place";

const local = {
  name: "Bar La Esquina",
  address: "Honduras 5200, Palermo",
  city: "Palermo",
  latitude: -34.5875,
  longitude: -58.43,
};

describe("companyPlaceFromProfile", () => {
  it("toma ciudad y coordenadas del local, y muestra la dirección", () => {
    expect(companyPlaceFromProfile(local)).toEqual({
      label: "Honduras 5200, Palermo",
      city: "Palermo",
      latitude: -34.5875,
      longitude: -58.43,
    });
  });

  it("sin dirección muestra la ciudad, y sin ciudad el nombre del comercio", () => {
    expect(companyPlaceFromProfile({ ...local, address: null })?.label).toBe("Palermo");
    expect(companyPlaceFromProfile({ ...local, address: null, city: null })).toMatchObject({
      label: "Bar La Esquina",
      city: "",
    });
  });

  it("un local sin coordenadas no es una zona", () => {
    expect(companyPlaceFromProfile({ ...local, latitude: null })).toBeNull();
    expect(companyPlaceFromProfile({ ...local, longitude: null })).toBeNull();
  });
});
