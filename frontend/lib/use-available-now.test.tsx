import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
vi.mock("@/lib/api", () => ({
  api: { get: (...args: unknown[]) => get(...args), post: vi.fn(), del: vi.fn() },
}));
vi.mock("@/lib/geolocation", () => ({ getCurrentPosition: vi.fn() }));

import { useAvailableNow } from "./use-available-now";

const NOW = new Date("2026-11-19T18:00:00Z");
const hasta = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  get.mockReset();
  setVisibility("visible");
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useAvailableNow", () => {
  it("lee el estado al montar y se apaga solo al llegar la hora de vencimiento", async () => {
    get.mockResolvedValue({ active: true, until: hasta(4 * 3600_000) });
    const { result } = renderHook(() => useAvailableNow("tok"));
    await act(async () => {});
    expect(result.current.active).toBe(true);
    expect(get).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(4 * 3600_000 - 1000));
    expect(result.current.active).toBe(true);

    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(result.current.active).toBe(false);
    expect(result.current.until).toBeNull();
    expect(get).toHaveBeenCalledTimes(1); // apagarlo no necesita un pedido
  });

  it("si ya venció al leerlo, queda apagado", async () => {
    get.mockResolvedValue({ active: true, until: hasta(-1000) });
    const { result } = renderHook(() => useAvailableNow("tok"));
    await act(async () => {});
    expect(result.current.active).toBe(false);
  });

  it("al volver a primer plano vuelve a pedir el estado real", async () => {
    get.mockResolvedValueOnce({ active: true, until: hasta(4 * 3600_000) });
    const { result } = renderHook(() => useAvailableNow("tok"));
    await act(async () => {});
    expect(result.current.active).toBe(true);

    // El servidor lo apagó (la persona lo cortó desde otro dispositivo).
    get.mockResolvedValueOnce({ active: false, until: null });
    setVisibility("hidden");
    expect(get).toHaveBeenCalledTimes(1); // oculta: no pide
    await act(async () => setVisibility("visible"));
    expect(get).toHaveBeenCalledTimes(2);
    expect(result.current.active).toBe(false);
  });

  it("al volver a primer plano con la hora vencida lo apaga aunque el pedido falle", async () => {
    get.mockResolvedValueOnce({ active: true, until: hasta(3600_000) });
    const { result } = renderHook(() => useAvailableNow("tok"));
    await act(async () => {});
    expect(result.current.active).toBe(true);

    get.mockRejectedValueOnce(new Error("sin red"));
    // La pestaña estuvo suspendida: el reloj saltó sin disparar el timer.
    vi.setSystemTime(new Date(NOW.getTime() + 2 * 3600_000));
    await act(async () => setVisibility("visible"));
    expect(result.current.active).toBe(false);
  });

  it("sin sesión no pide nada", async () => {
    const { result } = renderHook(() => useAvailableNow(null));
    await act(async () => setVisibility("visible"));
    expect(get).not.toHaveBeenCalled();
    expect(result.current.active).toBe(false);
  });
});
