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
const gps = vi.fn();
vi.mock("@/lib/geolocation", () => ({
  getCurrentPosition: (...args: unknown[]) => gps(...args),
}));

beforeEach(() => {
  post.mockReset().mockResolvedValue({});
  del.mockReset().mockResolvedValue({});
  gps.mockReset().mockResolvedValue({ latitude: -34.6, longitude: -58.4 });
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
    await waitFor(() => expect(result.current.cleared).toBe(true));
    expect(del).toHaveBeenCalledWith("/shifts/turno-1/en-route", undefined, "tok");
    expect(result.current.mayBeVisible).toBe(false);
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
    expect(result.current.clearing).toBe(false);
    expect(result.current.mayBeVisible).toBe(true);
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

  it.each([409, 429, 500, 502, 401])(
    "un %i del servidor NO se da por borrado: reintenta y, si sigue, avisa",
    async (status) => {
      vi.useFakeTimers();
      del.mockRejectedValue(new ApiError(status, "No se pudo"));
      const { result } = renderHook(() => useEnRouteSharing("turno-1", "tok"));
      await act(() => result.current.start());

      act(() => result.current.stop());
      await act(() => vi.advanceTimersByTimeAsync(0));
      expect(result.current.cleared).toBe(false);
      expect(result.current.clearing).toBe(true);
      await act(() => vi.advanceTimersByTimeAsync(4_000 * 5));

      expect(del).toHaveBeenCalledTimes(5);
      expect(result.current.cleared).toBe(false);
      expect(result.current.mayBeVisible).toBe(true);
      expect(result.current.error).toBe(STOP_FAILED_MESSAGE);
    }
  );

  it("un 409 que al reintentar sale bien queda borrado", async () => {
    vi.useFakeTimers();
    del.mockRejectedValueOnce(new ApiError(409, "Otra escritura")).mockResolvedValue({});
    const { result } = renderHook(() => useEnRouteSharing("turno-1", "tok"));
    await act(() => result.current.start());

    act(() => result.current.stop());
    await act(() => vi.advanceTimersByTimeAsync(4_000));

    expect(del).toHaveBeenCalledTimes(2);
    expect(result.current.cleared).toBe(true);
    expect(result.current.mayBeVisible).toBe(false);
  });

  it("si el turno ya no es suyo (404), no hay nada que borrar: no reintenta ni muestra error", async () => {
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

  it("un reporte que estaba esperando el GPS cuando se apagó ya no sale", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useEnRouteSharing("turno-1", "tok"));
    await act(() => result.current.start());
    expect(post).toHaveBeenCalledTimes(1);
    // El tick de los 60 s arranca y queda esperando el GPS.
    let soltarGps: (p: { latitude: number; longitude: number }) => void = () => {};
    gps.mockImplementationOnce(() => new Promise((resolve) => (soltarGps = resolve)));
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(post).toHaveBeenCalledTimes(1);

    act(() => result.current.stop());
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(del).toHaveBeenCalledTimes(1);
    // El GPS contesta después del borrado: ese reporte no se manda.
    await act(async () => {
      soltarGps({ latitude: -34.5, longitude: -58.5 });
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(post).toHaveBeenCalledTimes(1);
    expect(result.current.cleared).toBe(true);
  });

  it("el borrado espera al reporte que ya está en la red: nunca sale antes", async () => {
    vi.useFakeTimers();
    const orden: string[] = [];
    const { result } = renderHook(() => useEnRouteSharing("turno-1", "tok"));
    await act(() => result.current.start());
    let terminarPost: () => void = () => {};
    post.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          terminarPost = () => {
            orden.push("POST llegó");
            resolve({});
          };
        })
    );
    del.mockImplementation(() => {
      orden.push("DELETE");
      return Promise.resolve({});
    });
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(post).toHaveBeenCalledTimes(2);

    act(() => result.current.stop());
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(del).not.toHaveBeenCalled();
    await act(async () => {
      terminarPost();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(orden).toEqual(["POST llegó", "DELETE"]);
    expect(result.current.cleared).toBe(true);
  });

  it("un error pasajero en un tick (409, 5xx) no corta el viaje", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useEnRouteSharing("turno-1", "tok"));
    await act(() => result.current.start());
    post.mockRejectedValueOnce(new ApiError(503, "Servidor ocupado"));

    await act(() => vi.advanceTimersByTimeAsync(60_000));

    expect(result.current.sharing).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(post).toHaveBeenCalledTimes(3);
    expect(result.current.sharing).toBe(true);
  });

  it("si el servidor corta el viaje, la última posición puede seguir guardada y se dice", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useEnRouteSharing("turno-1", "tok"));
    await act(() => result.current.start());
    post.mockRejectedValueOnce(new ApiError(400, "Este turno ya no está en viaje."));

    await act(() => vi.advanceTimersByTimeAsync(60_000));

    expect(result.current.sharing).toBe(false);
    expect(result.current.error).toBe("Este turno ya no está en viaje.");
    // La tarjeta ofrece «Borrar mi última ubicación» mientras no se confirme.
    expect(result.current.mayBeVisible).toBe(true);
    expect(result.current.cleared).toBe(false);
  });
});
