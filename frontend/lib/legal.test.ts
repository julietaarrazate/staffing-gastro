import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LEGAL_LAST_UPDATED, LEGAL_TERMS_VERSION } from "./legal";

/**
 * La versión que muestran /terminos y /privacidad y la que guarda el backend
 * al crear una cuenta son el mismo dato escrito en dos lugares. Si alguien
 * sube una y se olvida de la otra, la constancia de aceptación quedaría
 * mintiendo sobre qué texto se aceptó.
 */
describe("versión de términos y privacidad", () => {
  it("coincide con la que guarda el backend", () => {
    const python = readFileSync(
      resolve(__dirname, "../../backend/app/modules/identity/domain/value_objects.py"),
      "utf8"
    );
    const match = python.match(/^LEGAL_TERMS_VERSION = "([^"]+)"$/m);
    expect(match?.[1]).toBe(LEGAL_TERMS_VERSION);
  });

  it("la fecha visible corresponde al mismo mes", () => {
    const meses = [
      "enero", "febrero", "marzo", "abril", "mayo", "junio",
      "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    ];
    const [anio, mes] = LEGAL_TERMS_VERSION.split("-");
    expect(LEGAL_LAST_UPDATED).toBe(
      `Última actualización: ${meses[Number(mes) - 1]} ${anio}`
    );
  });
});
