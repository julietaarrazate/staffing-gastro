import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NotificationBell, { RECONNECT_REFRESH_MIN_GAP_MS } from "./NotificationBell";

// VIE-04: la campanita se relee al volver a primer plano y al volver la red.

const apiGet = vi.fn();
vi.mock("@/lib/api", () => ({ api: { get: (...a: unknown[]) => apiGet(...a), post: vi.fn() } }));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ token: "tok" }) }));
vi.mock("@/lib/useWebSocket", () => ({ useWebSocket: () => ({ status: "open" }) }));
const emit = vi.fn();
vi.mock("@/lib/live-refresh", () => ({ emitLiveRefresh: () => emit() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/feed" }));

let visibilidad: "visible" | "hidden" = "visible";

beforeEach(() => {
  vi.useFakeTimers();
  apiGet.mockReset();
  apiGet.mockResolvedValue([]);
  emit.mockReset();
  visibilidad = "visible";
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibilidad,
  });
});
afterEach(() => vi.useRealTimers());

async function montar() {
  render(<NotificationBell />);
  await act(async () => {});
  return apiGet.mock.calls.length;
}

function cambiarVisibilidad(a: "visible" | "hidden") {
  visibilidad = a;
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

describe("NotificationBell: al reanudar", () => {
  it("al volver a primer plano relee la lista, sin avisarle a las pantallas (ya lo hacen)", async () => {
    const inicial = await montar();
    cambiarVisibilidad("hidden");
    cambiarVisibilidad("visible");
    expect(apiGet.mock.calls.length - inicial).toBe(1);
    expect(apiGet).toHaveBeenLastCalledWith("/notifications", "tok");
    expect(emit).not.toHaveBeenCalled();
  });

  it("al pasar a segundo plano no pide nada", async () => {
    const inicial = await montar();
    cambiarVisibilidad("hidden");
    expect(apiGet.mock.calls.length - inicial).toBe(0);
  });

  it("al volver la red relee la lista y avisa a las pantallas", async () => {
    const inicial = await montar();
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(apiGet.mock.calls.length - inicial).toBe(1);
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it("respeta el piso: varios eventos seguidos valen una sola recarga", async () => {
    const inicial = await montar();
    for (let i = 0; i < 5; i++) {
      cambiarVisibilidad("hidden");
      cambiarVisibilidad("visible");
      act(() => {
        window.dispatchEvent(new Event("online"));
      });
      act(() => vi.advanceTimersByTime(1000));
    }
    expect(apiGet.mock.calls.length - inicial).toBe(1);
  });

  it("pasado el piso, vuelve a contar", async () => {
    const inicial = await montar();
    cambiarVisibilidad("visible");
    act(() => vi.advanceTimersByTime(RECONNECT_REFRESH_MIN_GAP_MS + 1));
    cambiarVisibilidad("visible");
    expect(apiGet.mock.calls.length - inicial).toBe(2);
  });

  it("un online con la pestaña oculta no pide nada", async () => {
    const inicial = await montar();
    visibilidad = "hidden";
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(apiGet.mock.calls.length - inicial).toBe(0);
  });
});
