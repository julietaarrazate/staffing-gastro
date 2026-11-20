import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NotificationBell from "./NotificationBell";
import { AvisosProvider, RECONNECT_REFRESH_MIN_GAP_MS } from "@/lib/avisos";

const apiGet = vi.fn();
vi.mock("@/lib/api", () => ({ api: { get: (...a: unknown[]) => apiGet(...a), post: vi.fn() } }));
const auth = vi.hoisted(() => ({ token: "tok" as string | null }));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ token: auth.token }) }));
const ws = vi.hoisted(() => ({
  onOpen: null as null | (() => void),
  onMessage: null as null | ((frame: unknown) => void),
}));
vi.mock("@/lib/useWebSocket", () => ({
  useWebSocket: (_p: unknown, _t: unknown, onMessage: (f: unknown) => void, onOpen: () => void) => {
    ws.onOpen = onOpen;
    ws.onMessage = onMessage;
    return { status: "open" };
  },
}));
const emit = vi.fn();
vi.mock("@/lib/live-refresh", () => ({ emitLiveRefresh: () => emit() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/feed" }));

beforeEach(() => {
  vi.useFakeTimers();
  apiGet.mockReset();
  apiGet.mockResolvedValue([]);
  emit.mockReset();
  auth.token = "tok";
});
afterEach(() => vi.useRealTimers());

async function montar() {
  const view = render(<AvisosProvider><NotificationBell /></AvisosProvider>);
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
    rerender(<AvisosProvider><NotificationBell /></AvisosProvider>);
    await act(async () => {});
    act(() => ws.onOpen?.());
    expect(emit).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Notificaciones" })).toBeInTheDocument();
  });
});

describe("NotificationBell: cuadro de refresco (VIE-01)", () => {
  it("un cuadro sin id pide el refresco y no entra en la campanita", async () => {
    await montar();
    act(() => ws.onMessage?.({ type: "live_refresh" }));
    expect(emit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Notificaciones" })).not.toHaveTextContent(/\d/);
  });

  it("un aviso de verdad sigue sumando y pidiendo el refresco", async () => {
    await montar();
    act(() =>
      ws.onMessage?.({ id: "n1", type: "new_applicant", title: "t", message: "m", read: false, link: null, created_at: null })
    );
    expect(emit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Notificaciones" })).toHaveTextContent("1");
  });
});
