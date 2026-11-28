import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NotificationBell from "./NotificationBell";
import { AvisosProvider } from "@/lib/avisos";
import type { Notification } from "@/lib/types";

const apiGet = vi.fn();
const apiPost = vi.fn();
vi.mock("@/lib/api", () => ({
  api: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
  },
}));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ token: "tok", user: { id: "u" }, loading: false }) }));
vi.mock("@/lib/useWebSocket", () => ({ useWebSocket: () => undefined }));
let pathname = "/chats/s1";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => pathname,
}));

function chat(id: string, shift: string): Notification {
  return {
    id,
    type: "chat_message",
    title: "Nuevo mensaje de Ana",
    message: "Hola",
    read: false,
    link: `/chats/${shift}`,
    created_at: "2026-11-17T12:00:00Z",
  };
}

beforeEach(() => {
  apiGet.mockReset();
  apiPost.mockReset();
  apiPost.mockResolvedValue({});
});

describe("NotificationBell: chat abierto (U017)", () => {
  it("marca leídos los avisos de mensaje de la conversación abierta, y sólo esos", async () => {
    pathname = "/chats/s1";
    apiGet.mockResolvedValue([chat("a", "s1"), chat("b", "s2")]);
    render(<AvisosProvider><NotificationBell /></AvisosProvider>);
    const campana = screen.getByRole("button", { name: "Avisos" });
    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(1));
    expect(apiPost).toHaveBeenCalledWith("/notifications/a/read", undefined, "tok");
    // Queda sólo el de la otra conversación.
    await waitFor(() => expect(campana).toHaveTextContent("1"));
  });

  it("fuera de un chat no marca nada", async () => {
    pathname = "/feed";
    apiGet.mockResolvedValue([chat("a", "s1")]);
    render(<AvisosProvider><NotificationBell /></AvisosProvider>);
    const campana = screen.getByRole("button", { name: "Avisos" });
    await waitFor(() => expect(campana).toHaveTextContent("1"));
    expect(apiPost).not.toHaveBeenCalled();
  });

  it("con la pestaña oculta no marca; al volver a verla, sí", async () => {
    pathname = "/chats/s1";
    apiGet.mockResolvedValue([chat("a", "s1")]);
    const vis = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    render(<AvisosProvider><NotificationBell /></AvisosProvider>);
    const campana = screen.getByRole("button", { name: "Avisos" });
    await waitFor(() => expect(campana).toHaveTextContent("1"));
    expect(apiPost).not.toHaveBeenCalled();
    vis.mockReturnValue("visible");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith("/notifications/a/read", undefined, "tok"));
    vis.mockRestore();
  });
});
