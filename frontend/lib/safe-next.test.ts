import { describe, expect, it } from "vitest";
import { isSessionEndReason, loginHref, safeNext } from "@/lib/safe-next";

describe("safeNext: sólo rutas internas", () => {
  it.each([
    ["/shifts/new", "/shifts/new"],
    ["/turno/abc-123", "/turno/abc-123"],
    ["/shifts/7/candidates?orden=cerca", "/shifts/7/candidates?orden=cerca"],
    ["/profile#datos", "/profile#datos"],
    ["/", "/"],
    // Una dirección adentro de la query no saca de la app.
    ["/buscar?q=https://otro.sitio", "/buscar?q=https://otro.sitio"],
    // Los `..` se resuelven y siguen adentro.
    ["/shifts/../feed", "/feed"],
  ])("acepta %s", (value, expected) => {
    expect(safeNext(value)).toBe(expected);
  });

  it.each([
    ["vacío", ""],
    ["otro sitio", "https://otro.sitio/login"],
    ["otro sitio sin protocolo", "//otro.sitio"],
    ["otro sitio con tres barras", "///otro.sitio"],
    ["barra invertida", "/\\otro.sitio"],
    ["barra invertida más adentro", "/feed\\..\\..\\otro.sitio"],
    ["javascript:", "javascript:alert(1)"],
    ["data:", "data:text/html,hola"],
    ["ruta relativa", "shifts/new"],
    ["tabulación que el navegador saca", "/\t/otro.sitio"],
    ["salto de línea", "/\n/otro.sitio"],
    ["espacio antes de la barra", " /feed"],
    ["el propio ingreso", "/login"],
    ["el propio ingreso con query", "/login?next=/login"],
    ["demasiado largo", `/${"a".repeat(600)}`],
  ])("rechaza %s", (_name, value) => {
    expect(safeNext(value)).toBeNull();
  });

  it("rechaza null y undefined", () => {
    expect(safeNext(null)).toBeNull();
    expect(safeNext(undefined)).toBeNull();
  });
});

describe("loginHref", () => {
  it("sin nada es el ingreso pelado", () => {
    expect(loginHref()).toBe("/login");
  });

  it("lleva el motivo y la ruta en la que estaba la persona", () => {
    expect(loginHref({ motivo: "vencida", next: "/shifts/new" })).toBe(
      "/login?motivo=vencida&next=%2Fshifts%2Fnew"
    );
  });

  it("no manda un `next` que no sea interno, ni la raíz", () => {
    expect(loginHref({ motivo: "vencida", next: "//otro.sitio" })).toBe("/login?motivo=vencida");
    expect(loginHref({ next: "/" })).toBe("/login");
  });
});

describe("isSessionEndReason", () => {
  it("sólo conoce los dos motivos", () => {
    expect(isSessionEndReason("vencida")).toBe(true);
    expect(isSessionEndReason("suspendida")).toBe(true);
    expect(isSessionEndReason("cualquier cosa")).toBe(false);
    expect(isSessionEndReason(null)).toBe(false);
  });
});
