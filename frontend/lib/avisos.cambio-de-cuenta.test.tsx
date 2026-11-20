import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AvisosProvider, useAvisos } from "./avisos";

/**
 * Privacidad (revisión del 2026-11-20): el proveedor de avisos vive en el
 * layout y no se desmonta al cerrar sesión. Quien entra después en el mismo
 * equipo no puede ver, ni un instante, la lista ni la cuenta de avisos de la
 * cuenta anterior.
 */
type Pendiente = { resolve: (v: unknown) => void; reject: (e: unknown) => void };
const pedidos: Pendiente[] = [];
vi.mock("@/lib/api", () => ({
  api: {
    get: () => new Promise((resolve, reject) => pedidos.push({ resolve, reject })),
    post: vi.fn(),
  },
}));
let auth: Record<string, unknown>;
vi.mock("@/lib/auth-context", () => ({ useAuth: () => auth }));
vi.mock("@/lib/useWebSocket", () => ({ useWebSocket: () => undefined }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/feed" }));

const aviso = (id: string, title: string) => ({ id, type: "shift_assigned", title, message: "m", read: false, link: null, created_at: "2026-11-20T12:00:00Z" });
const sesion = (id: string | null) => ({ token: id ? `tok-${id}` : null, user: id ? { id } : null, loading: false, twoFactorSetupPending: false });

function Espia() {
  const { activo, notifications, unreadCount, loading } = useAvisos();
  return <p data-testid="espia">{`${activo ? "on" : "off"}|${unreadCount}|${loading ? "cargando" : "listo"}|${notifications.map((n) => n.title).join(",")}`}</p>;
}
const arbol = () => <AvisosProvider><Espia /></AvisosProvider>;
const estado = () => screen.getByTestId("espia").textContent;

beforeEach(() => {
  pedidos.length = 0;
});

describe("avisos: cambio de cuenta", () => {
  it("al salir y entrar con otra cuenta no queda nada de la anterior mientras carga la nueva", async () => {
    auth = sesion("a");
    const { rerender } = render(arbol());
    await act(async () => pedidos[0].resolve([aviso("1", "De A"), aviso("2", "De A también")]));
    expect(estado()).toBe("on|2|listo|De A,De A también");

    auth = sesion(null);
    rerender(arbol());
    expect(estado()).toBe("off|0|listo|");

    auth = sesion("b");
    rerender(arbol());
    // El pedido de B sigue colgado: ni la lista ni la cuenta de A.
    expect(estado()).toBe("on|0|cargando|");

    await act(async () => pedidos[1].resolve([aviso("9", "De B")]));
    expect(estado()).toBe("on|1|listo|De B");
  });

  it("de una cuenta a otra sin pasar por «sin sesión» (el admin que entra como otra persona) tampoco", async () => {
    auth = sesion("a");
    const { rerender } = render(arbol());
    await act(async () => pedidos[0].resolve([aviso("1", "De A")]));

    auth = sesion("b");
    rerender(arbol());
    expect(estado()).toBe("on|0|cargando|");
  });

  it("una respuesta de la cuenta anterior que llega tarde no pisa la lista de la nueva", async () => {
    auth = sesion("a");
    const { rerender } = render(arbol());
    auth = sesion("b");
    rerender(arbol());
    await act(async () => pedidos[1].resolve([aviso("9", "De B")]));
    await act(async () => pedidos[0].resolve([aviso("1", "De A")]));
    expect(estado()).toBe("on|1|listo|De B");
  });

  it("si el pedido de la cuenta nueva falla, no vuelve la lista de la anterior", async () => {
    auth = sesion("a");
    const { rerender } = render(arbol());
    await act(async () => pedidos[0].resolve([aviso("1", "De A")]));
    auth = sesion("b");
    rerender(arbol());
    await act(async () => pedidos[1].reject(new Error("sin red")));
    expect(estado()).toBe("on|0|listo|");
  });

  it("renovar la sesión (token nuevo, misma cuenta) no vacía la lista", async () => {
    auth = sesion("a");
    const { rerender } = render(arbol());
    await act(async () => pedidos[0].resolve([aviso("1", "De A")]));
    auth = { ...sesion("a"), token: "tok-a-renovado" };
    rerender(arbol());
    expect(estado()).toBe("on|1|listo|De A");
  });
});
