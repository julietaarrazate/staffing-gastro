import { describe, expect, it } from "vitest";
import { shortAddress } from "./geocoder";

describe("shortAddress", () => {
  it("arma «Calle 1234, Barrio» con los campos estructurados", () => {
    expect(
      shortAddress("1234, Av. Corrientes, San Nicolás, Comuna 1, Buenos Aires, 1043, Argentina", {
        road: "Avenida Corrientes",
        house_number: "1234",
        suburb: "San Nicolás",
        city: "Buenos Aires",
      })
    ).toBe("Avenida Corrientes 1234, San Nicolás");
  });

  it("sin altura devuelve calle y localidad", () => {
    expect(shortAddress("x", { road: "Defensa", town: "Tigre" })).toBe("Defensa, Tigre");
  });

  it("sin zona devuelve sólo la calle", () => {
    expect(shortAddress("x", { road: "Defensa", house_number: "10" })).toBe("Defensa 10");
  });

  it("sin calle estructurada cae a los primeros segmentos de display_name", () => {
    expect(shortAddress("Palermo, Comuna 14, Buenos Aires, Argentina", {})).toBe(
      "Palermo, Comuna 14, Buenos Aires"
    );
    expect(shortAddress(undefined)).toBe("");
  });
});
