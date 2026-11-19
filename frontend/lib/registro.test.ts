import { describe, expect, it } from "vitest";
import { motivoBloqueoRegistro } from "./registro";

const ok = { nombre: "Ana", nacimiento: "1995-05-20", email: "a@b.com", clave: "abcd1234", terminos: true, falta_verificacion: false };

describe("motivoBloqueoRegistro", () => {
  it("sin motivo cuando está todo", () => expect(motivoBloqueoRegistro(ok)).toBeNull());
  it("nombre de puros espacios", () =>
    expect(motivoBloqueoRegistro({ ...ok, nombre: "   " })).toMatch(/nombre/));
  it("menor de 18", () =>
    expect(motivoBloqueoRegistro({ ...ok, nacimiento: "2015-01-01" })).toMatch(/mayores de 18/));
  it("sin fecha de nacimiento", () =>
    expect(motivoBloqueoRegistro({ ...ok, nacimiento: "" })).toMatch(/fecha de nacimiento/));
  it("clave corta", () => expect(motivoBloqueoRegistro({ ...ok, clave: "abc" })).toMatch(/8 caracteres/));
  it("clave de un solo carácter repetido", () =>
    expect(motivoBloqueoRegistro({ ...ok, clave: "aaaaaaaa" })).toMatch(/repetido/));
  it("términos sin aceptar", () =>
    expect(motivoBloqueoRegistro({ ...ok, terminos: false })).toMatch(/términos/));
  it("falta la verificación de seguridad", () =>
    expect(motivoBloqueoRegistro({ ...ok, falta_verificacion: true })).toMatch(/verificación/));
});
