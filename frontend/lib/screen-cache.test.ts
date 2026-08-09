import { describe, expect, it } from "vitest";
import { clearAllCached, clearCached, getCached, setCached } from "@/lib/screen-cache";

describe("screen-cache", () => {
  it("getCached devuelve undefined para una clave nunca guardada", () => {
    expect(getCached("nunca-usada")).toBeUndefined();
  });

  it("setCached/getCached guardan y recuperan el último valor", () => {
    setCached("worker-feed", { shifts: [1, 2, 3] });
    expect(getCached("worker-feed")).toEqual({ shifts: [1, 2, 3] });
  });

  it("clearCached invalida sólo la clave indicada", () => {
    setCached("a", 1);
    setCached("b", 2);
    clearCached("a");
    expect(getCached("a")).toBeUndefined();
    expect(getCached("b")).toBe(2);
  });

  it("clearAllCached vacía todas las entradas (logout en pestaña compartida)", () => {
    setCached("worker-feed", { name: "María" });
    setCached("company-profile", { name: "Restaurante X" });
    clearAllCached();
    expect(getCached("worker-feed")).toBeUndefined();
    expect(getCached("company-profile")).toBeUndefined();
  });
});
