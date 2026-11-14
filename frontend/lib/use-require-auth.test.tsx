import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRequireAuth } from "@/lib/use-require-auth";

const replace = vi.fn();
vi.mock("next/navigation", () => {
  const router = { replace: (...args: unknown[]) => replace(...args) };
  return { useRouter: () => router };
});

let auth: Record<string, unknown>;
vi.mock("@/lib/auth-context", () => ({ useAuth: () => auth }));

const SIN_SESION = {
  user: null,
  token: null,
  loading: false,
  justLoggedOut: false,
  sessionEnded: null,
  reconnecting: false,
};

beforeEach(() => {
  replace.mockReset();
  window.history.replaceState(null, "", "/shifts/new?desde=panel");
  auth = { ...SIN_SESION };
});

describe("useRequireAuth: a dónde manda una pantalla protegida sin sesión", () => {
  it("mientras se restaura la sesión no manda a ningún lado", () => {
    auth = { ...SIN_SESION, loading: true };
    renderHook(() => useRequireAuth());
    expect(replace).not.toHaveBeenCalled();
  });

  it("con sesión no manda a ningún lado", () => {
    auth = { ...SIN_SESION, token: "t", user: { id: "u" } };
    renderHook(() => useRequireAuth());
    expect(replace).not.toHaveBeenCalled();
  });

  it("con el servidor sin contestar (reconectando) no manda al ingreso", () => {
    auth = { ...SIN_SESION, reconnecting: true };
    renderHook(() => useRequireAuth());
    expect(replace).not.toHaveBeenCalled();
  });

  it("si la sesión venció, va al ingreso con el motivo y la ruta para volver", () => {
    auth = { ...SIN_SESION, sessionEnded: "vencida" };
    renderHook(() => useRequireAuth());
    expect(replace).toHaveBeenCalledWith(
      "/login?motivo=vencida&next=%2Fshifts%2Fnew%3Fdesde%3Dpanel"
    );
  });

  it("si la cuenta quedó suspendida, el motivo es ese", () => {
    auth = { ...SIN_SESION, sessionEnded: "suspendida" };
    renderHook(() => useRequireAuth());
    expect(replace).toHaveBeenCalledWith(
      "/login?motivo=suspendida&next=%2Fshifts%2Fnew%3Fdesde%3Dpanel"
    );
  });

  it("recién cerrada la sesión va a la landing, no al ingreso", () => {
    auth = { ...SIN_SESION, justLoggedOut: true };
    renderHook(() => useRequireAuth());
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("quien llega sin haber ingresado nunca va al ingreso, que lo devuelve acá", () => {
    renderHook(() => useRequireAuth());
    expect(replace).toHaveBeenCalledWith("/login?next=%2Fshifts%2Fnew%3Fdesde%3Dpanel");
  });
});
