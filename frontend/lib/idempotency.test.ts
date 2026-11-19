import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { ApiError } from "./api";
import { VENTANA_REINTENTO_MS, esErrorDefinitivo, useIdempotencyKeys } from "./idempotency";

describe("useIdempotencyKeys con persistencia", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("tras una recarga el intento sigue siendo el mismo", () => {
    const a = renderHook(() => useIdempotencyKeys("k"));
    const key = a.result.current.keyFor("crear");
    a.unmount();
    const b = renderHook(() => useIdempotencyKeys("k"));
    expect(b.result.current.keyFor("crear")).toBe(key);
  });

  it("clear suelta la key también del almacenamiento", () => {
    const a = renderHook(() => useIdempotencyKeys("k"));
    const key = a.result.current.keyFor("crear");
    a.result.current.clear("crear");
    expect(window.sessionStorage.getItem("k")).toBeNull();
    const b = renderHook(() => useIdempotencyKeys("k"));
    expect(b.result.current.keyFor("crear")).not.toBe(key);
  });

  it("sin persistKey no toca el almacenamiento", () => {
    const a = renderHook(() => useIdempotencyKeys());
    a.result.current.keyFor("x");
    expect(window.sessionStorage.length).toBe(0);
  });
});

describe("useIdempotencyKeys: reintento tras una respuesta perdida", () => {
  beforeEach(() => window.sessionStorage.clear());
  afterEach(() => vi.useRealTimers());

  it("el reintento reusa la key y la posición del primer intento (CON-01)", () => {
    const h = renderHook(() => useIdempotencyKeys());
    const key = h.result.current.keyFor("turno-1:check-in");
    h.result.current.recordar("turno-1:check-in", { latitude: -34.6, longitude: -58.4 });
    expect(h.result.current.keyFor("turno-1:check-in")).toBe(key);
    expect(h.result.current.recordado("turno-1:check-in")).toEqual({
      latitude: -34.6,
      longitude: -58.4,
    });
  });

  it("al terminar bien, la key y la posición se sueltan", () => {
    const h = renderHook(() => useIdempotencyKeys());
    const key = h.result.current.keyFor("turno-1:check-in");
    h.result.current.recordar("turno-1:check-in", { latitude: 1, longitude: 2 });
    h.result.current.clear("turno-1:check-in");
    expect(h.result.current.recordado("turno-1:check-in")).toBeUndefined();
    expect(h.result.current.keyFor("turno-1:check-in")).not.toBe(key);
  });

  it("un error definitivo suelta la key; uno de red la deja (CON-12)", () => {
    const h = renderHook(() => useIdempotencyKeys());
    const key = h.result.current.keyFor("turno-1:confirm");
    h.result.current.clearSiTermino("turno-1:confirm", new TypeError("Failed to fetch"));
    expect(h.result.current.keyFor("turno-1:confirm")).toBe(key);
    h.result.current.clearSiTermino("turno-1:confirm", new ApiError(409, "Esta operación ya está en curso"));
    expect(h.result.current.keyFor("turno-1:confirm")).toBe(key);
    h.result.current.clearSiTermino("turno-1:confirm", new ApiError(422, "Fuera de la ventana"));
    expect(h.result.current.keyFor("turno-1:confirm")).not.toBe(key);
  });

  it("una key sin terminar vence pasada la ventana de reintento (CON-12)", () => {
    vi.useFakeTimers();
    const h = renderHook(() => useIdempotencyKeys());
    const key = h.result.current.keyFor("turno-1:confirm");
    h.result.current.recordar("turno-1:confirm", { latitude: 1, longitude: 2 });
    vi.advanceTimersByTime(VENTANA_REINTENTO_MS - 1000);
    expect(h.result.current.keyFor("turno-1:confirm")).toBe(key);
    vi.advanceTimersByTime(2000);
    expect(h.result.current.recordado("turno-1:confirm")).toBeUndefined();
    expect(h.result.current.keyFor("turno-1:confirm")).not.toBe(key);
  });

  it("lee el formato viejo del almacenamiento (sólo el string de la key)", () => {
    window.sessionStorage.setItem("k", JSON.stringify({ crear: "clave-vieja" }));
    const h = renderHook(() => useIdempotencyKeys("k"));
    expect(h.result.current.keyFor("crear")).toBe("clave-vieja");
  });

  it("esErrorDefinitivo: sólo respuestas 4xx que no son timeout ni «en curso»", () => {
    expect(esErrorDefinitivo(new ApiError(404, "x"))).toBe(true);
    expect(esErrorDefinitivo(new ApiError(422, "x"))).toBe(true);
    expect(esErrorDefinitivo(new ApiError(409, "x"))).toBe(false);
    expect(esErrorDefinitivo(new ApiError(408, "x"))).toBe(false);
    expect(esErrorDefinitivo(new ApiError(502, "x"))).toBe(false);
    expect(esErrorDefinitivo(new Error("red"))).toBe(false);
  });
});

describe("esErrorDefinitivo: lo que se reintenta con la misma clave", () => {
  it("408, 409 y 429 no son definitivos; 400, 404 y 422 sí", () => {
    const con = (status: number) => new ApiError(status, "x");
    expect([408, 409, 429].map((s) => esErrorDefinitivo(con(s)))).toEqual([false, false, false]);
    expect([400, 404, 422].map((s) => esErrorDefinitivo(con(s)))).toEqual([true, true, true]);
  });
});
