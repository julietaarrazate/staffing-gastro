import { describe, expect, it } from "vitest";
import {
  anchoEstimadoPastilla,
  colocarPastillas,
  ladoDePastilla,
  proyectarEnEncuadre,
  PASTILLA_MAX,
  PASTILLA_MIN,
} from "./pastillas";

describe("anchoEstimadoPastilla", () => {
  it("crece con el nombre y se corta en 140 px", () => {
    expect(anchoEstimadoPastilla("Bar")).toBeLessThan(anchoEstimadoPastilla("Café Thames"));
    expect(anchoEstimadoPastilla("Un restaurante con un nombre larguísimo de verdad")).toBe(PASTILLA_MAX);
  });
});

describe("ladoDePastilla", () => {
  const base = { pinAncho: 100, pastilla: 100, mapaAncho: 390 };

  it("a la derecha cuando entra", () => {
    // Se le deja el lugar que hay (hasta 140), no sólo lo estimado.
    expect(ladoDePastilla({ ...base, pinX: 100 })).toEqual({ lado: "derecha", ancho: 140 });
  });

  it("se voltea a la izquierda si no entra a la derecha (borde de la pantalla)", () => {
    expect(ladoDePastilla({ ...base, pinX: 300 })).toEqual({ lado: "izquierda", ancho: 140 });
  });

  it("el borde justo: entra a la derecha hasta el margen y se voltea un píxel después", () => {
    // derecha libre = 390 - 6 - (x + 50 + 4) ; con x = 230 → 100 (entra justo)
    expect(ladoDePastilla({ ...base, pinX: 230 })?.lado).toBe("derecha");
    expect(ladoDePastilla({ ...base, pinX: 231 })?.lado).toBe("izquierda");
  });

  it("si no entra en ningún lado, se achica al lado con más lugar; si ni así llega al mínimo, no se muestra", () => {
    const chico = ladoDePastilla({ pinX: 160, pinAncho: 100, pastilla: 140, mapaAncho: 320 });
    expect(chico?.ancho).toBeLessThan(140);
    expect(chico?.ancho).toBeGreaterThanOrEqual(PASTILLA_MIN);
    expect(ladoDePastilla({ pinX: 160, pinAncho: 240, pastilla: 140, mapaAncho: 320 })).toBeNull();
  });
});

describe("colocarPastillas", () => {
  const pin = (id: string, x: number, y: number, nombre: string | null = "Local") => ({ id, nombre, x, y, pinAncho: 90 });

  it("sin nombre no hay pastilla", () => {
    expect(colocarPastillas([pin("a", 100, 300, null)], 390, null).size).toBe(0);
  });

  it("dos pastillas que se pisan: queda la del pin elegido aunque llegue segunda", () => {
    const pines = [pin("a", 100, 300), pin("b", 110, 310)];
    expect([...colocarPastillas(pines, 390, "b").keys()]).toEqual(["b"]);
    expect([...colocarPastillas(pines, 390, "a").keys()]).toEqual(["a"]);
  });

  it("sin elegido (o elegido que no pisa), queda la primera en el orden recibido", () => {
    const pines = [pin("a", 100, 300), pin("b", 110, 310)];
    expect([...colocarPastillas(pines, 390, null).keys()]).toEqual(["a"]);
  });

  it("las que no se pisan se ven todas, cada una del lado que le entra", () => {
    const r = colocarPastillas([pin("a", 60, 200), pin("b", 340, 500)], 390, null);
    expect(r.get("a")?.lado).toBe("derecha");
    expect(r.get("b")?.lado).toBe("izquierda");
  });
});

describe("proyectarEnEncuadre", () => {
  const bbox: [number, number, number, number] = [-58.44, -34.6, -58.42, -34.58];
  it("las esquinas y el centro caen donde corresponde", () => {
    expect(proyectarEnEncuadre(bbox, 400, 800, -58.44, -34.58)).toEqual({ x: 0, y: 0 });
    const abajo = proyectarEnEncuadre(bbox, 400, 800, -58.42, -34.6);
    expect(abajo.x).toBeCloseTo(400);
    expect(abajo.y).toBeCloseTo(800);
    const medio = proyectarEnEncuadre(bbox, 400, 800, -58.43, -34.59);
    expect(medio.x).toBeCloseTo(200);
    expect(medio.y).toBeCloseTo(400, 0);
  });
});
