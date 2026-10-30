import { afterEach, describe, expect, it, vi } from "vitest";
import { RESPALDO } from "@/components/landing/planes";
import {
  PLANES_CONOCIDOS,
  borrarPlanElegido,
  destinoTrasBienvenida,
  guardarPlanElegido,
  leerPlanElegido,
  planValido,
  urlAltaConPlan,
  urlMiPlan,
} from "./plan-elegido";

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe("planValido", () => {
  it("acepta los tres planes", () => {
    expect(planValido("inicial")).toBe("inicial");
    expect(planValido("basico")).toBe("basico");
    expect(planValido("pro")).toBe("pro");
  });

  it("perdona mayúsculas y espacios de un link escrito a mano", () => {
    expect(planValido(" Basico ")).toBe("basico");
  });

  it("rechaza lo que no es un plan", () => {
    expect(planValido(null)).toBeNull();
    expect(planValido(undefined)).toBeNull();
    expect(planValido("")).toBeNull();
    expect(planValido("free")).toBeNull();
    expect(planValido("básico")).toBeNull();
    expect(planValido("pro&rol=admin")).toBeNull();
  });

  it("conoce los mismos códigos que los precios de la landing", () => {
    expect([...PLANES_CONOCIDOS].sort()).toEqual(RESPALDO.map((p) => p.code).sort());
  });
});

describe("las direcciones", () => {
  it("el alta va como comercio y con el plan", () => {
    expect(urlAltaConPlan("basico")).toBe("/register?rol=comercio&plan=basico");
  });
  it("Mi plan lleva el plan a resaltar", () => {
    expect(urlMiPlan("pro")).toBe("/subscription?plan=pro");
  });
});

describe("el plan guardado durante el alta", () => {
  it("se guarda, se lee y se borra", () => {
    expect(leerPlanElegido()).toBeNull();
    guardarPlanElegido("pro");
    expect(leerPlanElegido()).toBe("pro");
    borrarPlanElegido();
    expect(leerPlanElegido()).toBeNull();
  });

  it("si alguien tocó lo guardado y no es un plan, se ignora", () => {
    window.sessionStorage.setItem("staffya_plan_elegido", "gratis");
    expect(leerPlanElegido()).toBeNull();
  });

  it("al terminar la bienvenida lleva a Mi plan una sola vez", () => {
    guardarPlanElegido("basico");
    expect(destinoTrasBienvenida("/shifts")).toBe("/subscription?plan=basico");
    expect(destinoTrasBienvenida("/shifts")).toBe("/shifts");
  });

  it("sin plan elegido, el destino de siempre", () => {
    expect(destinoTrasBienvenida("/shifts")).toBe("/shifts");
  });

  it("sin almacenamiento (modo privado), no rompe: destino de siempre", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("bloqueado", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("bloqueado", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("bloqueado", "SecurityError");
    });
    expect(() => guardarPlanElegido("basico")).not.toThrow();
    expect(leerPlanElegido()).toBeNull();
    expect(() => borrarPlanElegido()).not.toThrow();
    expect(destinoTrasBienvenida("/shifts")).toBe("/shifts");
  });
});
