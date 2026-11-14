import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NotificationBell, { RECONNECT_REFRESH_MIN_GAP_MS } from "./NotificationBell";

const apiGet = vi.fn();
vi.mock("@/lib/api", () => ({ api: { get: (...a: unknown[]) => apiGet(...a), post: vi.fn() } }));
const auth = vi.hoisted(() => ({ token: "tok" as string | null }));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ token: auth.token }) }));
const ws = vi.hoisted(() => ({ onOpen: null as null | (() => void) }));
vi.mock("@/lib/useWebSocket", () => ({
  useWebSocket: (_p: unknown, _t: unknown, _m: unknown, onOpen: () => void) => {
    ws.onOpen = onOpen;
    return { status: "open" };
  },
}));
const emit = vi.fn();
vi.mock("@/lib/live-refresh", () => ({ emitLiveRefresh: () => emit() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

beforeEach(() => {
  vi.useFakeTimers();
  apiGet.mockReset();
  apiGet.mockResolvedValue([]);
  emit.mockReset();
  auth.token = "tok";
});
afterEach(() => vi.useRealTimers());

async function montar() {
  const view = render(<NotificationBell />);
  await act(async () => {});
  return view;
}

describe("NotificationBell: reaperturas del socket", () => {
  it("la primera apertura no cuenta; N aperturas seguidas valen una sola recarga", async () => {
    await montar();
    const inicial = apiGet.mock.calls.length;
    act(() => ws.onOpen?.()); // primera apertura: coincide con la carga inicial
    for (let i = 0; i < 6; i++) {
      act(() => ws.onOpen?.());
      act(() => vi.advanceTimersByTime(1500));
    }
    expect(apiGet.mock.calls.length - inicial).toBe(1);
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it("pasado el piso, una reconexión vuelve a contar", async () => {
    await montar();
    act(() => ws.onOpen?.());
    act(() => ws.onOpen?.());
    expect(emit).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(RECONNECT_REFRESH_MIN_GAP_MS + 1));
    act(() => ws.onOpen?.());
    expect(emit).toHaveBeenCalledTimes(2);
  });

  it("al cambiar el token (otra sesión) la primera apertura vuelve a ser la inicial", async () => {
    const { rerender } = await montar();
    act(() => ws.onOpen?.());
    auth.token = "otro";
    rerender(<NotificationBell />);
    await act(async () => {});
    act(() => ws.onOpen?.());
    expect(emit).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Notificaciones" })).toBeInTheDocument();
  });
});
