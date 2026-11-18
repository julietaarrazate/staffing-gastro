import { describe, expect, it } from "vitest";
import { comoDesbloquear, estadoDePush } from "./push-estado";

const base = {
  soportado: true,
  permiso: "default",
  plataforma: "android",
  instalada: false,
} as const;

describe("estadoDePush", () => {
  it.each(["default", "granted"] as const)(
    "con permiso %s es un interruptor",
    (permiso) => {
      expect(estadoDePush({ ...base, permiso })).toBe("interruptor");
    },
  );

  it("con el permiso bloqueado no es un interruptor", () => {
    expect(estadoDePush({ ...base, permiso: "denied" })).toBe("bloqueado");
  });

  it("iPhone sin instalar (el navegador no tiene push) pide instalar la app", () => {
    expect(
      estadoDePush({
        soportado: false,
        permiso: null,
        plataforma: "iphone",
        instalada: false,
      }),
    ).toBe("instalar");
  });

  it("sin soporte y sin nada que hacer se oculta", () => {
    expect(
      estadoDePush({
        soportado: false,
        permiso: null,
        plataforma: "compu",
        instalada: false,
      }),
    ).toBe("oculto");
    expect(
      estadoDePush({
        soportado: false,
        permiso: null,
        plataforma: "iphone",
        instalada: true,
      }),
    ).toBe("oculto");
  });
});

describe("comoDesbloquear", () => {
  it("cada lugar tiene su camino", () => {
    expect(comoDesbloquear("iphone", true)).toMatch(/Ajustes del iPhone/);
    expect(comoDesbloquear("android", true)).toMatch(/Información de la app/);
    expect(comoDesbloquear("compu", false)).toMatch(/candado/);
    expect(comoDesbloquear(null, false)).toMatch(/candado/);
  });
});
