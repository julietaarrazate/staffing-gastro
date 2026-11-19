import { afterEach, describe, expect, it, vi } from "vitest";
import {
  VIGENCIA_MS,
  borrarOrigen,
  capturarOrigen,
  origenDeUrl,
  origenGuardado,
} from "./origen-alta";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

const AHORA = 1_800_000_000_000;

describe("origenDeUrl", () => {
  it("toma ref, utm_source y utm_campaign y deja lo demás", () => {
    expect(
      origenDeUrl("?ref=grupo-palermo&utm_source=ig&utm_campaign=fundadores&utm_medium=social&x=1")
    ).toEqual({ ref: "grupo-palermo", utm_source: "ig", utm_campaign: "fundadores" });
  });

  it("sin parámetros de origen (o vacíos) no hay origen", () => {
    expect(origenDeUrl("")).toBeNull();
    expect(origenDeUrl("?rol=comercio&plan=basico")).toBeNull();
    expect(origenDeUrl("?ref=%20%20&utm_source=")).toBeNull();
  });

  it("recorta lo que es enorme", () => {
    expect(origenDeUrl(`?ref=${"a".repeat(5000)}`)?.ref).toHaveLength(200);
  });
});

describe("capturar y leer", () => {
  it("guarda el enlace de entrada y lo devuelve mientras está vigente", () => {
    capturarOrigen("?utm_source=ig&utm_campaign=bio", AHORA);
    expect(origenGuardado(AHORA + 1000)).toEqual({ utm_source: "ig", utm_campaign: "bio" });
    expect(origenGuardado(AHORA + VIGENCIA_MS)).toEqual({ utm_source: "ig", utm_campaign: "bio" });
  });

  it("gana el último enlace con origen; uno sin origen no borra el anterior", () => {
    capturarOrigen("?ref=volante", AHORA);
    capturarOrigen("?ref=grupo-palermo", AHORA + 10);
    capturarOrigen("/register?rol=comercio", AHORA + 20);
    capturarOrigen("", AHORA + 30);
    expect(origenGuardado(AHORA + 40)).toEqual({ ref: "grupo-palermo" });
  });

  it("a los 30 días vence y se borra", () => {
    capturarOrigen("?ref=volante", AHORA);
    expect(origenGuardado(AHORA + VIGENCIA_MS + 1)).toBeNull();
    expect(window.localStorage.length).toBe(0);
  });

  it("un valor roto o del futuro se descarta", () => {
    window.localStorage.setItem("oido_origen_alta", "{no es json");
    expect(origenGuardado(AHORA)).toBeNull();
    window.localStorage.setItem("oido_origen_alta", JSON.stringify({ ref: "x", guardado: AHORA + 99 }));
    expect(origenGuardado(AHORA)).toBeNull();
    window.localStorage.setItem("oido_origen_alta", JSON.stringify({ ref: 42, guardado: AHORA }));
    expect(origenGuardado(AHORA)).toBeNull();
  });

  it("borrarOrigen lo saca", () => {
    capturarOrigen("?ref=volante", AHORA);
    borrarOrigen();
    expect(origenGuardado(AHORA)).toBeNull();
  });

  it("sin almacenamiento no rompe nada", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    expect(() => capturarOrigen("?ref=volante", AHORA)).not.toThrow();
    expect(origenGuardado(AHORA)).toBeNull();
    expect(() => borrarOrigen()).not.toThrow();
  });
});
