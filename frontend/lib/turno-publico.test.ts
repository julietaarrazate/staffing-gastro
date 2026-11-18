import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import type { ShiftPublic } from "@/lib/types";
import { leerTurnoPublico } from "./turno-publico";

/**
 * Qué muestra `/turno/[id]` según lo que contesta la API. El bug que motivó
 * este test: todo lo que no fuera 200 terminaba en la página 404 por defecto
 * de Next, en inglés, y no se distinguía «ya se tomó» de «no existe».
 */

const get = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: { get: (...args: unknown[]) => get(...args) },
}));

const ID = "3f2b8c1e-5a47-4d09-9c1b-7e6a2d4f8b10";

const SHIFT: ShiftPublic = {
  id: ID,
  position: "mozo",
  start_at: "2026-11-14T23:00:00Z",
  end_at: "2026-11-15T05:00:00Z",
  city: "Palermo",
  pay_amount: "42000.00",
  currency: "ARS",
  company_name: "Tinto",
  tips: false,
  meal: false,
  dress_code: null,
  urgent: false,
};

// Con llaves: si la flecha devuelve el mock, Vitest lo toma por una función de
// limpieza y lo llama al terminar cada test.
beforeEach(() => {
  get.mockReset();
});

describe("leerTurnoPublico", () => {
  it("un turno abierto trae la vista pública", async () => {
    get.mockResolvedValue(SHIFT);
    expect(await leerTurnoPublico(ID)).toEqual({ estado: "abierto", shift: SHIFT });
    expect(get).toHaveBeenCalledWith(`/shifts/${ID}/public`);
  });

  it("410 es «ya no disponible»: se tomó, se canceló o pasó la hora", async () => {
    get.mockRejectedValue(new ApiError(410, "Este turno ya no está disponible"));
    expect(await leerTurnoPublico(ID)).toEqual({ estado: "no_disponible" });
  });

  it("404 es «no existe»", async () => {
    get.mockRejectedValue(new ApiError(404, "Turno no encontrado"));
    expect(await leerTurnoPublico(ID)).toEqual({ estado: "no_encontrado" });
  });

  it("un id que no es UUID no existe, y ni se le pregunta a la API", async () => {
    expect(await leerTurnoPublico("no-es-un-id")).toEqual({ estado: "no_encontrado" });
    expect(get).not.toHaveBeenCalled();
  });

  it("si la API falla, el error sigue de largo (no se disfraza de «no existe»)", async () => {
    get.mockRejectedValue(new ApiError(503, "Servicio no disponible"));
    await expect(leerTurnoPublico(ID)).rejects.toMatchObject({ status: 503 });
  });
});
