import { beforeEach, describe, expect, it } from "vitest";
import {
  CLAVE_BORRADOR_TURNO,
  guardarBorradorTurno,
  leerBorradorTurno,
  mezclarConIA,
  borrarBorradorTurno,
  type BorradorTurno,
  type CampoTurno,
} from "./borrador-turno";
import { PREFIJO_BORRADOR, borrarBorradores } from "./almacen-sesion";
import { pasoAlcanzable, pasoDeUrl, urlDePaso } from "./paso-url";

const base: BorradorTurno = {
  owner: "u1",
  position: "mozo",
  startAt: "2030-01-01T20:00",
  endAt: "2030-01-02T02:00",
  payAmount: "45000",
  tips: true,
  meal: false,
  urgent: false,
  dressCode: "",
  city: "Palermo",
  latitude: -34.5,
  longitude: -58.4,
  describeText: "mozo sábado",
  tocados: ["position"],
  servidor: { id: "s1", saved: "{}" },
  pendingCreate: { a: 1 },
};

describe("borrador del turno en sessionStorage", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("sobrevive a una recarga y es de una sola cuenta", () => {
    guardarBorradorTurno(base);
    expect(leerBorradorTurno("u1")).toEqual(base);
    expect(leerBorradorTurno("otra")).toBeNull();
  });

  it("un borrador corrupto no rompe: se ignora", () => {
    window.sessionStorage.setItem(CLAVE_BORRADOR_TURNO, "{no es json");
    expect(leerBorradorTurno("u1")).toBeNull();
    window.sessionStorage.setItem(
      CLAVE_BORRADOR_TURNO,
      JSON.stringify({ ...base, position: "astronauta" })
    );
    expect(leerBorradorTurno("u1")).toBeNull();
  });

  it("borrar y cerrar sesión lo limpian", () => {
    guardarBorradorTurno(base);
    borrarBorradorTurno();
    expect(leerBorradorTurno("u1")).toBeNull();
    window.sessionStorage.setItem(`${PREFIJO_BORRADOR}x`, "1");
    window.sessionStorage.setItem("otra-cosa", "1");
    borrarBorradores();
    expect(window.sessionStorage.getItem(`${PREFIJO_BORRADOR}x`)).toBeNull();
    expect(window.sessionStorage.getItem("otra-cosa")).toBe("1");
  });

  it("sin sessionStorage no lanza", () => {
    const original = Object.getOwnPropertyDescriptor(window, "sessionStorage")!;
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get() {
        throw new Error("bloqueado");
      },
    });
    try {
      expect(() => guardarBorradorTurno(base)).not.toThrow();
      expect(leerBorradorTurno("u1")).toBeNull();
      expect(() => borrarBorradorTurno()).not.toThrow();
      expect(() => borrarBorradores()).not.toThrow();
    } finally {
      Object.defineProperty(window, "sessionStorage", original);
    }
  });
});

describe("mezclarConIA", () => {
  const actual = {
    position: "mozo" as const,
    startAt: "",
    endAt: "",
    payAmount: "50000",
    tips: true,
    meal: false,
    urgent: false,
    dressCode: "",
  };
  const ia = {
    position: "bartender" as const,
    startAt: "2030-01-01T20:00",
    endAt: "2030-01-02T02:00",
    payAmount: "45000",
    tips: false,
    meal: true,
    urgent: true,
    dressCode: "negro",
  };

  it("no pisa lo que la persona tocó", () => {
    const tocados = new Set<CampoTurno>(["position", "payAmount", "tips"]);
    const r = mezclarConIA(actual, ia, tocados);
    expect(r.position).toBe("mozo");
    expect(r.payAmount).toBe("50000");
    expect(r.tips).toBe(true);
    expect(r.startAt).toBe("2030-01-01T20:00");
    expect(r.meal).toBe(true);
    expect(r.dressCode).toBe("negro");
  });

  it("lo que la IA no resolvió queda como estaba", () => {
    const r = mezclarConIA(actual, { ...ia, position: null, payAmount: null, startAt: "" }, new Set());
    expect(r.position).toBe("mozo");
    expect(r.payAmount).toBe("50000");
    expect(r.startAt).toBe("");
  });
});

describe("paso en la dirección", () => {
  it("lee y acota el paso", () => {
    expect(pasoDeUrl(null, 3)).toBe(0);
    expect(pasoDeUrl("2", 3)).toBe(2);
    expect(pasoDeUrl("9", 3)).toBe(3);
    expect(pasoDeUrl("-1", 3)).toBe(0);
    expect(pasoDeUrl("x", 3)).toBe(0);
  });

  it("arma la dirección, limpia en el paso 0", () => {
    expect(urlDePaso("/shifts/new", 0)).toBe("/shifts/new");
    expect(urlDePaso("/shifts/new", 2)).toBe("/shifts/new?paso=2");
  });

  it("no deja saltear pasos incompletos", () => {
    expect(pasoAlcanzable(3, [true, false, true])).toBe(1);
    expect(pasoAlcanzable(3, [true, true, true])).toBe(3);
    expect(pasoAlcanzable(2, [false, true, true])).toBe(0);
  });
});
