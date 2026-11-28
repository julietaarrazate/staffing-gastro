import { describe, expect, it } from "vitest";
import { comoLlegarHref, lugarDelTurno } from "./como-llegar";

describe("comoLlegarHref", () => {
  it("con coordenadas va al punto exacto", () => {
    expect(comoLlegarHref({ address: "Gorriti 5000", latitude: -34.58, longitude: -58.43 })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=-34.58,-58.43"
    );
  });
  it("sin coordenadas usa la dirección escrita, con la ciudad", () => {
    expect(comoLlegarHref({ address: "Gorriti 5000", city: "Palermo" })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=Gorriti%205000%2C%20Palermo"
    );
  });
  it("sin ninguna de las dos no hay enlace", () => {
    expect(comoLlegarHref({ city: "Palermo" })).toBeNull();
    expect(comoLlegarHref({ address: "  " })).toBeNull();
  });
});

describe("lugarDelTurno", () => {
  it("dirección y zona, sólo zona, o nada", () => {
    expect(lugarDelTurno({ address: "Gorriti 5000", city: "Palermo" })).toBe("Gorriti 5000, Palermo");
    expect(lugarDelTurno({ city: "Palermo" })).toBe("Palermo");
    expect(lugarDelTurno({})).toBeNull();
  });
});
