import { describe, expect, it } from "vitest";
import { isSessionEndReason, loginHref, registerHref, bienvenidaHref, safeNext } from "@/lib/safe-next";

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
    // Al resolver los `.` y `..` la `//` queda al inicio: otro sitio.
    ["punto y doble barra", "/.//otro.sitio"],
    ["dos puntos y doble barra", "/..//otro.sitio"],
    ["segmento que se cancela y doble barra", "/a/..//otro.sitio"],
    ["punto codificado y doble barra", "/%2e//otro.sitio"],
    ["dos puntos codificados y doble barra", "/%2e%2e//otro.sitio"],
    ["punto codificado en mayúscula", "/%2E//otro.sitio"],
    ["doble barra en el medio de la ruta", "/feed//otro.sitio"],
  ])("rechaza %s", (_name, value) => {
    expect(safeNext(value)).toBeNull();
  });

  it("nada de lo que devuelve resuelve a otro sitio", () => {
    const origin = "https://www.oido.com.ar";
    const tricky = [
      "/.//otro.sitio",
      "/..//otro.sitio",
      "/a/..//otro.sitio",
      "/%2e//otro.sitio",
      "/././/otro.sitio",
      "/a/b/../..//otro.sitio",
      "/.%2F/otro.sitio",
      "/%5Cotro.sitio",
      "/%09/otro.sitio",
      "/feed?x=//otro.sitio",
      "/feed#//otro.sitio",
      "/@otro.sitio",
      "/feed/..%2F..%2F/otro.sitio",
    ];
    for (const value of tricky) {
      const result = safeNext(value);
      if (result === null) continue;
      expect(new URL(result, `${origin}/login`).origin, value).toBe(origin);
      expect(result.startsWith("//"), value).toBe(false);
    }
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

describe("safeNext: pantallas que no son un destino", () => {
  it.each(["/login", "/register", "/register?rol=trabajador", "/bienvenida", "/bienvenida?next=/feed"])(
    "rechaza %s",
    (value) => {
      expect(safeNext(value)).toBeNull();
    }
  );
});

describe("registerHref", () => {
  it("sin nada es el alta pelada", () => {
    expect(registerHref()).toBe("/register");
  });

  it("lleva el rol y la ruta del turno", () => {
    expect(registerHref({ rol: "trabajador", next: "/turno/abc-123" })).toBe(
      "/register?rol=trabajador&next=%2Fturno%2Fabc-123"
    );
  });

  it("no manda un `next` externo, raro ni la raíz", () => {
    expect(registerHref({ rol: "trabajador", next: "https://otro.sitio" })).toBe("/register?rol=trabajador");
    expect(registerHref({ next: "//otro.sitio" })).toBe("/register");
    expect(registerHref({ next: "/\\otro.sitio" })).toBe("/register");
    expect(registerHref({ next: "/" })).toBe("/register");
    expect(registerHref({ next: "/login" })).toBe("/register");
  });
});

describe("bienvenidaHref", () => {
  it("lleva la ruta a la que volver y descarta lo que no es interno", () => {
    expect(bienvenidaHref("/turno/abc-123")).toBe("/bienvenida?next=%2Fturno%2Fabc-123");
    expect(bienvenidaHref("javascript:alert(1)")).toBe("/bienvenida");
    expect(bienvenidaHref(null)).toBe("/bienvenida");
  });
});
