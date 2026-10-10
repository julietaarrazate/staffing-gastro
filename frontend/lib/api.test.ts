import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  api,
  ApiError,
  bindSessionToken,
  renewSessionToken,
  resolveToken,
  setUnauthorizedHandler,
} from "@/lib/api";

function jsonResponse(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function authHeaderOf(call: unknown[]): string | undefined {
  const init = call[1] as RequestInit;
  return (init.headers as Record<string, string>).Authorization;
}

describe("token de la sesión", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    bindSessionToken("sesion");
    setUnauthorizedHandler(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    bindSessionToken(null);
    setUnauthorizedHandler(null);
  });

  it("una pantalla que pasa el token de la sesión sale con el renovado", async () => {
    renewSessionToken("renovado");
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

    await api.get("/x", "sesion");

    expect(authHeaderOf(fetchMock.mock.calls[0])).toBe("Bearer renovado");
  });

  it("un token que no es el de la sesión sale tal cual", async () => {
    renewSessionToken("renovado");
    fetchMock.mockResolvedValue(jsonResponse(200));

    await api.get("/auth/me", "recien-logueado");

    expect(authHeaderOf(fetchMock.mock.calls[0])).toBe("Bearer recien-logueado");
  });

  it("resolveToken sirve al WebSocket el mismo token que a las requests", () => {
    renewSessionToken("renovado");
    expect(resolveToken("sesion")).toBe("renovado");
    expect(resolveToken("otro")).toBe("otro");
    expect(resolveToken(null)).toBeNull();
  });

  it("ante un 401 renueva una vez y reintenta", async () => {
    const renew = vi.fn(async () => {
      renewSessionToken("nuevo");
      return "nuevo";
    });
    setUnauthorizedHandler(renew);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { detail: "Not authenticated" }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    const result = await api.get<{ ok: boolean }>("/x", "sesion");

    expect(result).toEqual({ ok: true });
    expect(renew).toHaveBeenCalledTimes(1);
    expect(authHeaderOf(fetchMock.mock.calls[1])).toBe("Bearer nuevo");
  });

  it("varias requests con 401 a la vez comparten una sola renovación", async () => {
    let resolveRenew: (token: string) => void = () => {};
    const renew = vi.fn(
      () =>
        new Promise<string | null>((resolve) => {
          resolveRenew = (token) => {
            renewSessionToken(token);
            resolve(token);
          };
        })
    );
    setUnauthorizedHandler(renew);
    fetchMock.mockImplementation(async (_url, init: RequestInit) =>
      (init.headers as Record<string, string>).Authorization === "Bearer nuevo"
        ? jsonResponse(200)
        : jsonResponse(401)
    );

    const pending = Promise.all([api.get("/a", "sesion"), api.get("/b", "sesion")]);
    await vi.waitFor(() => expect(renew).toHaveBeenCalled());
    resolveRenew("nuevo");
    await pending;

    expect(renew).toHaveBeenCalledTimes(1);
  });

  it("si no se puede renovar, el 401 llega a la pantalla", async () => {
    setUnauthorizedHandler(async () => null);
    fetchMock.mockResolvedValue(jsonResponse(401, { detail: "Not authenticated" }));

    await expect(api.get("/x", "sesion")).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("no reintenta en bucle si el token renovado también da 401", async () => {
    setUnauthorizedHandler(async () => "nuevo");
    fetchMock.mockResolvedValue(jsonResponse(401));

    await expect(api.get("/x", "sesion")).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("un 401 con un token ajeno no dispara la renovación", async () => {
    const renew = vi.fn(async () => "nuevo");
    setUnauthorizedHandler(renew);
    fetchMock.mockResolvedValue(jsonResponse(401));

    await expect(api.get("/x", "otro")).rejects.toBeInstanceOf(ApiError);
    expect(renew).not.toHaveBeenCalled();
  });
});
