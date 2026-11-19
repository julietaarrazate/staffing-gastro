import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tokenVencido, useWebSocket, WS_STABLE_AFTER_MS } from "./useWebSocket";

const apiGet = vi.fn();
const live = vi.hoisted(() => ({ token: null as string | null }));
const errores = vi.hoisted(() => ({
  ApiError: class ApiError extends Error {
    constructor(public status: number) {
      super("api");
    }
  },
}));
vi.mock("@/lib/api", () => ({
  ApiError: errores.ApiError,
  resolveToken: (t: string) => live.token ?? t,
  api: { get: (...a: unknown[]) => apiGet(...a) },
}));

function jwtQueVence(enSegundos: number): string {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "");
  const exp = Math.floor(Date.now() / 1000) + enSegundos;
  return `${b64({ alg: "HS256" })}.${b64({ exp })}.firma`;
}

class FakeSocket {
  static all: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    FakeSocket.all.push(this);
  }
  close() {}
}

beforeEach(() => {
  vi.useFakeTimers();
  apiGet.mockReset();
  apiGet.mockResolvedValue(undefined);
  live.token = null;
  FakeSocket.all = [];
  vi.stubGlobal("WebSocket", FakeSocket);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useWebSocket: backoff", () => {
  it("si el servidor abre y cierra enseguida, el backoff crece (no vuelve a ~1 s)", async () => {
    renderHook(() => useWebSocket("/x", "tok", () => {}));
    const delays: number[] = [];
    for (let i = 0; i < 5; i++) {
      const ws = FakeSocket.all[FakeSocket.all.length - 1];
      act(() => ws.onopen?.());
      act(() => ws.onclose?.());
      // Cuánto falta para la próxima conexión: se mide avanzando de a poco.
      const before = FakeSocket.all.length;
      let waited = 0;
      while (FakeSocket.all.length === before && waited < 20_000) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(100);
        });
        waited += 100;
      }
      delays.push(waited);
    }
    expect(delays).toEqual([1000, 2000, 4000, 8000, 15000]);
  });

  it("una conexión estable que se cae reintenta rápido (reconexión normal)", async () => {
    renderHook(() => useWebSocket("/x", "tok", () => {}));
    // Primero fallos rápidos para subir el backoff...
    for (let i = 0; i < 3; i++) {
      const ws = FakeSocket.all[FakeSocket.all.length - 1];
      act(() => ws.onopen?.());
      act(() => ws.onclose?.());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_000);
      });
    }
    // ...y una conexión que vive más que el umbral reinicia el backoff.
    const ws = FakeSocket.all[FakeSocket.all.length - 1];
    act(() => ws.onopen?.());
    act(() => vi.advanceTimersByTime(WS_STABLE_AFTER_MS + 1));
    const before = FakeSocket.all.length;
    act(() => ws.onclose?.());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(FakeSocket.all.length).toBe(before + 1);
  });
});

describe("useWebSocket: token vencido (PRI-04)", () => {
  it("tokenVencido: vencido o por vencer sí; vigente o ilegible no", () => {
    expect(tokenVencido(jwtQueVence(-60))).toBe(true);
    expect(tokenVencido(jwtQueVence(2))).toBe(true);
    expect(tokenVencido(jwtQueVence(600))).toBe(false);
    expect(tokenVencido("tok")).toBe(false);
  });

  it("si el servidor lo cortó por vencimiento, renueva con un pedido antes de reconectar", async () => {
    const viejo = jwtQueVence(600);
    const nuevo = jwtQueVence(900);
    renderHook(() => useWebSocket("/x", viejo, () => {}));
    expect(FakeSocket.all).toHaveLength(1);
    expect(FakeSocket.all[0].url).toContain(encodeURIComponent(viejo));

    // Pasa el tiempo: el token del socket venció y el servidor lo cortó.
    const ws = FakeSocket.all[0];
    act(() => ws.onopen?.());
    live.token = viejo;
    vi.setSystemTime(Date.now() + 700_000);
    apiGet.mockImplementation(async () => {
      live.token = nuevo; // lo que hace el 401 + refresh de `lib/api.ts`
    });
    act(() => ws.onclose?.());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(apiGet).toHaveBeenCalledTimes(1);
    expect(apiGet).toHaveBeenCalledWith("/auth/me", viejo);
    expect(FakeSocket.all).toHaveLength(2);
    expect(FakeSocket.all[1].url).toContain(encodeURIComponent(nuevo));
  });

  it("con el token vigente reconecta sin pedir nada", async () => {
    const vigente = jwtQueVence(600);
    renderHook(() => useWebSocket("/x", vigente, () => {}));
    act(() => FakeSocket.all[0].onopen?.());
    act(() => vi.advanceTimersByTime(WS_STABLE_AFTER_MS + 1)); // conexión estable
    act(() => FakeSocket.all[0].onclose?.());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(apiGet).not.toHaveBeenCalled();
    expect(FakeSocket.all).toHaveLength(2);
  });

  it("si la renovación falla, reconecta igual (el backoff sigue)", async () => {
    const viejo = jwtQueVence(-60);
    apiGet.mockRejectedValue(new Error("sin red"));
    renderHook(() => useWebSocket("/x", viejo, () => {}));
    await act(async () => {});
    expect(apiGet).toHaveBeenCalledTimes(1);
    expect(FakeSocket.all).toHaveLength(1);
  });

  it("una conexión que cierra sin abrir o sin durar renueva en el próximo intento, aunque el reloj diga que el token sirve", async () => {
    const vigente = jwtQueVence(600); // reloj atrasado: parece vigente, el servidor lo venció
    renderHook(() => useWebSocket("/x", vigente, () => {}));
    // Cierra sin haber abierto.
    act(() => FakeSocket.all[0].onclose?.());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(apiGet).toHaveBeenCalledTimes(1);
    expect(FakeSocket.all).toHaveLength(2);
    // Abre y cierra enseguida: otra vez.
    act(() => FakeSocket.all[1].onopen?.());
    act(() => FakeSocket.all[1].onclose?.());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(apiGet).toHaveBeenCalledTimes(2);
    expect(FakeSocket.all).toHaveLength(3);
  });

  it("si /auth/me responde 401 (la sesión terminó) corta los reintentos", async () => {
    const vigente = jwtQueVence(600);
    renderHook(() => useWebSocket("/x", vigente, () => {}));
    apiGet.mockRejectedValue(new errores.ApiError(401));
    act(() => FakeSocket.all[0].onclose?.());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(apiGet).toHaveBeenCalledTimes(1);
    expect(FakeSocket.all).toHaveLength(1);
  });
});
