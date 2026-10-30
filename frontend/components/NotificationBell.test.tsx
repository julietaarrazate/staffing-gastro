import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NotificationBell from "./NotificationBell";
import type { Notification } from "@/lib/types";

const apiGet = vi.fn();
const apiPost = vi.fn();
vi.mock("@/lib/api", () => ({
  api: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
  },
}));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ token: "tok" }) }));
vi.mock("@/lib/useWebSocket", () => ({ useWebSocket: () => undefined }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

function aviso(id: string, read: boolean): Notification {
  return {
    id,
    type: "new_shift_nearby",
    title: `Turno ${id}`,
    message: "Un comercio cerca tuyo busca mozo.",
    read,
    link: "/feed",
    created_at: "2026-10-30T12:00:00Z",
  };
}

const BOTON = { name: "Marcar todas como leídas" };

async function abrirPanel() {
  render(<NotificationBell />);
  const campana = screen.getByRole("button", { name: "Notificaciones" });
  await waitFor(() => expect(campana).toHaveTextContent("2"));
  fireEvent.click(campana);
  return campana;
}

beforeEach(() => {
  apiGet.mockReset();
  apiPost.mockReset();
  apiGet.mockResolvedValue([aviso("a", false), aviso("b", false), aviso("c", true)]);
});

describe("NotificationBell: marcar todas como leídas", () => {
  it("marca todo de una, al instante, con un solo pedido", async () => {
    let responder: (value: { marked: number }) => void = () => {};
    apiPost.mockReturnValue(new Promise((resolve) => (responder = resolve)));
    const campana = await abrirPanel();

    fireEvent.click(screen.getByRole("button", BOTON));

    // Optimista: el contador y el botón se van antes de que conteste el servidor.
    expect(campana).not.toHaveTextContent("2");
    expect(screen.queryByRole("button", BOTON)).not.toBeInTheDocument();
    expect(apiPost).toHaveBeenCalledTimes(1);
    expect(apiPost).toHaveBeenCalledWith("/notifications/read-all", undefined, "tok");
    responder({ marked: 2 });
    await waitFor(() => expect(campana).not.toHaveTextContent("2"));
  });

  it("si el pedido falla, vuelve atrás en silencio", async () => {
    apiPost.mockRejectedValue(new Error("sin red"));
    const campana = await abrirPanel();

    fireEvent.click(screen.getByRole("button", BOTON));

    await waitFor(() => expect(campana).toHaveTextContent("2"));
    expect(screen.getByRole("button", BOTON)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("sin avisos sin leer no aparece", async () => {
    apiGet.mockResolvedValue([aviso("c", true)]);
    render(<NotificationBell />);
    fireEvent.click(screen.getByRole("button", { name: "Notificaciones" }));

    expect(await screen.findByText("Turno c")).toBeInTheDocument();
    expect(screen.queryByRole("button", BOTON)).not.toBeInTheDocument();
  });
});
