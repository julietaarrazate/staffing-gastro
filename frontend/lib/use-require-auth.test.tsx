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

describe("useRequireAuth: guarda por rol (U098)", () => {
  const CON_SESION = { ...SIN_SESION, token: "t" };

  it("sin `roles` no mira el rol: se comporta como siempre", () => {
    auth = { ...CON_SESION, user: { id: "u", role: "worker" } };
    const { result } = renderHook(() => useRequireAuth());
    expect(replace).not.toHaveBeenCalled();
    expect(result.current.token).toBe("t");
    expect(result.current.allowed).toBe(true);
  });

  it("con un rol permitido deja pasar y conserva el token", () => {
    auth = { ...CON_SESION, user: { id: "u", role: "employer" } };
    const { result } = renderHook(() => useRequireAuth({ roles: ["employer"] }));
    expect(replace).not.toHaveBeenCalled();
    expect(result.current.token).toBe("t");
    expect(result.current.allowed).toBe(true);
  });

  it("con un rol no permitido manda a la home de su rol y no entrega el token", () => {
    auth = { ...CON_SESION, user: { id: "u", role: "worker" } };
    const { result } = renderHook(() => useRequireAuth({ roles: ["employer"] }));
    expect(replace).toHaveBeenCalledWith("/feed");
    expect(result.current.token).toBeNull();
    expect(result.current.allowed).toBe(false);
  });

  it("un comercio en una pantalla de trabajador va a /shifts; un admin, a /admin", () => {
    auth = { ...CON_SESION, user: { id: "u", role: "employer" } };
    renderHook(() => useRequireAuth({ roles: ["worker"] }));
    expect(replace).toHaveBeenCalledWith("/shifts");
    replace.mockReset();
    auth = { ...CON_SESION, user: { id: "u", role: "admin" } };
    renderHook(() => useRequireAuth({ roles: ["worker"] }));
    expect(replace).toHaveBeenCalledWith("/admin");
  });

  it("mientras se restaura la sesión no redirige, aunque el rol no coincida", () => {
    auth = { ...CON_SESION, loading: true, user: { id: "u", role: "worker" } };
    const { result } = renderHook(() => useRequireAuth({ roles: ["employer"] }));
    expect(replace).not.toHaveBeenCalled();
    expect(result.current.token).toBe("t");
  });

  it("con el usuario todavía sin cargar no decide nada", () => {
    auth = { ...CON_SESION, user: null };
    renderHook(() => useRequireAuth({ roles: ["employer"] }));
    expect(replace).not.toHaveBeenCalled();
  });
});

