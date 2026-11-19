import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import type { User } from "@/lib/types";

const get = vi.fn();
vi.mock("@/lib/api", async (orig) => {
  const real = await orig<typeof import("@/lib/api")>();
  return { ...real, api: { get: (...a: unknown[]) => get(...a) } };
});

import { comercioSinPerfilTras400, destinoTrasIngreso, faltaPerfil } from "./perfil-faltante";

const usuario = (role: User["role"]) => ({ id: "u", role }) as User;

describe("faltaPerfil", () => {
  beforeEach(() => get.mockReset());

  it("404 del perfil = falta; con perfil = no falta", async () => {
    get.mockRejectedValueOnce(new ApiError(404, "Todavía no creaste tu perfil de trabajador"));
    expect(await faltaPerfil("t", "worker")).toBe(true);
    expect(get).toHaveBeenLastCalledWith("/workers/me/profile", "t");
    get.mockResolvedValueOnce({});
    expect(await faltaPerfil("t", "employer")).toBe(false);
    expect(get).toHaveBeenLastCalledWith("/companies/me/profile", "t");
  });

  it("un error de red o un 500 no manda a nadie a la bienvenida", async () => {
    get.mockRejectedValueOnce(new ApiError(500, "boom"));
    expect(await faltaPerfil("t", "worker")).toBe(false);
    get.mockRejectedValueOnce(new Error("offline"));
    expect(await faltaPerfil("t", "employer")).toBe(false);
  });

  it("el admin no tiene perfil y ni se consulta", async () => {
    expect(await faltaPerfil("t", "admin")).toBe(false);
    expect(get).not.toHaveBeenCalled();
  });
});

describe("destinoTrasIngreso", () => {
  beforeEach(() => get.mockReset());

  it("sin perfil va a /bienvenida y conserva `next`", async () => {
    get.mockRejectedValueOnce(new ApiError(404, "x")).mockRejectedValueOnce(new ApiError(404, "x"));
    const s = { token: "t", user: usuario("employer") };
    expect(await destinoTrasIngreso(s, "/turno/abc")).toBe("/bienvenida?next=%2Fturno%2Fabc");
    expect(await destinoTrasIngreso(s, null)).toBe("/bienvenida");
  });

  it("con perfil sigue al destino de siempre", async () => {
    get.mockResolvedValue({});
    const s = { token: "t", user: usuario("worker") };
    expect(await destinoTrasIngreso(s, "/turno/abc")).toBe("/turno/abc");
    expect(await destinoTrasIngreso(s, null)).toBe("/");
  });

  it("sin sesión abierta no consulta nada", async () => {
    expect(await destinoTrasIngreso(undefined, null)).toBe("/");
    expect(get).not.toHaveBeenCalled();
  });
});

describe("comercioSinPerfilTras400", () => {
  beforeEach(() => get.mockReset());

  it("un 400 se confirma con el perfil: 404 = falta; con perfil, es otro error", async () => {
    get.mockRejectedValueOnce(new ApiError(404, "x"));
    expect(await comercioSinPerfilTras400(new ApiError(400, "cualquier texto"), "t")).toBe(true);
    expect(get).toHaveBeenLastCalledWith("/companies/me/profile", "t");
    get.mockResolvedValueOnce({});
    expect(await comercioSinPerfilTras400(new ApiError(400, "Primero creá tu perfil de comercio"), "t")).toBe(false);
  });

  it("lo que no es un 400 no consulta nada", async () => {
    expect(await comercioSinPerfilTras400(new ApiError(500, "boom"), "t")).toBe(false);
    expect(await comercioSinPerfilTras400(new Error("offline"), "t")).toBe(false);
    expect(get).not.toHaveBeenCalled();
  });
});
