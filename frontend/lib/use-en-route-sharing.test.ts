import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { STOP_FAILED_MESSAGE, useEnRouteSharing } from "./use-en-route-sharing";

const post = vi.fn();
const del = vi.fn();

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: {
    post: (...args: unknown[]) => post(...args),
    del: (...args: unknown[]) => del(...args),
  },
}));
vi.mock("@/lib/geolocation", () => ({
  getCurrentPosition: () => Promise.resolve({ latitude: -34.6, longitude: -58.4 }),
}));

beforeEach(() => {
  post.mockReset().mockResolvedValue({});
  del.mockReset().mockResolvedValue({});
});
afterEach(() => {
  vi.useRealTimers();
});

/**
 * U072: «Dejar de compartir» también le pide al servidor que borre la última
 * posición. Antes sólo cortaba el intervalo y el comercio la seguía viendo.
 */
describe("useEnRouteSharing · dejar de compartir", () => {
  it("al apagar, pide borrar la última posición en el servidor", async () => {
    const { result } = renderHook(() => useEnRouteSharing("turno-1", "tok"));
    await act(() => result.current.start());
    expect(result.current.sharing).toBe(true);

    act(() => result.current.stop());

    expect(result.current.sharing).toBe(false);
    expect(del).toHaveBeenCalledWith("/shifts/turno-1/en-route", undefined, "tok");
    await waitFor(() => expect(result.current.cleared).toBe(true));
    expect(result.current.error).toBeNull();
  });

  it("sin red reintenta solo y, si no puede, avisa que el comercio todavía la ve", async () => {
    vi.useFakeTimers();
    del.mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => useEnRouteSharing("turno-1", "tok"));
    await act(() => result.current.start());

    act(() => result.current.stop());
    await act(() => vi.advanceTimersByTimeAsync(4_000 * 5));

    expect(del).toHaveBeenCalledTimes(5);
    expect(result.current.cleared).toBe(false);
    expect(result.current.clearFailed).toBe(true);
    expect(result.current.error).toBe(STOP_FAILED_MESSAGE);
  });

  it("si la red vuelve durante los reintentos, queda borrada y sin error", async () => {
    vi.useFakeTimers();
    del.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValue({});
    const { result } = renderHook(() => useEnRouteSharing("turno-1", "tok"));
    await act(() => result.current.start());

    act(() => result.current.stop());
    await act(() => vi.advanceTimersByTimeAsync(4_000));

    expect(del).toHaveBeenCalledTimes(2);
    expect(result.current.cleared).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("si el servidor contesta que no hay nada que apagar, no reintenta ni muestra error", async () => {
    del.mockRejectedValue(new ApiError(404, "Turno no encontrado"));
    const { result } = renderHook(() => useEnRouteSharing("turno-1", "tok"));
    await act(() => result.current.start());

    act(() => result.current.stop());

    await waitFor(() => expect(result.current.cleared).toBe(true));
    expect(del).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
  });

  it("«Borrar mi última ubicación» borra sin haber compartido en esta pantalla", async () => {
    const { result } = renderHook(() => useEnRouteSharing("turno-1", "tok"));

    act(() => result.current.clearLast());

    await waitFor(() => expect(result.current.cleared).toBe(true));
    expect(post).not.toHaveBeenCalled();
    expect(del).toHaveBeenCalledTimes(1);
  });

  it("volver a compartir cancela un borrado que seguía reintentando", async () => {
    vi.useFakeTimers();
    del.mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => useEnRouteSharing("turno-1", "tok"));
    await act(() => result.current.start());
    act(() => result.current.stop());
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(del).toHaveBeenCalledTimes(1);

    await act(() => result.current.start());
    await act(() => vi.advanceTimersByTimeAsync(4_000 * 3));

    expect(del).toHaveBeenCalledTimes(1);
    expect(result.current.sharing).toBe(true);
  });
});
