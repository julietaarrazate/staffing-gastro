import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NotificationBell from "./NotificationBell";
import { AvisosProvider } from "@/lib/avisos";

const apiGet = vi.fn();
vi.mock("@/lib/api", () => ({ api: { get: (...a: unknown[]) => apiGet(...a), post: vi.fn() } }));
let auth: Record<string, unknown>;
vi.mock("@/lib/auth-context", () => ({ useAuth: () => auth }));
const useWebSocket = vi.fn();
vi.mock("@/lib/useWebSocket", () => ({ useWebSocket: (...a: unknown[]) => useWebSocket(...a) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/admin/seguridad",
}));

beforeEach(() => {
  apiGet.mockReset();
  apiGet.mockResolvedValue([]);
  useWebSocket.mockReset();
});

describe("NotificationBell: admin con el alta de 2FA pendiente (U133)", () => {
  it("no se dibuja, no pide notificaciones y no abre el socket", () => {
    auth = { token: "tok", twoFactorSetupPending: true };
    render(<AvisosProvider><NotificationBell /></AvisosProvider>);
    expect(screen.queryByRole("button", { name: "Notificaciones" })).not.toBeInTheDocument();
    expect(apiGet).not.toHaveBeenCalled();
    expect(useWebSocket.mock.calls.every((c) => c[0] === null && c[1] === null)).toBe(true);
  });

  it("con el alta resuelta, carga como siempre", () => {
    auth = { token: "tok", twoFactorSetupPending: false };
    render(<AvisosProvider><NotificationBell /></AvisosProvider>);
    expect(apiGet).toHaveBeenCalledWith("/notifications", "tok");
  });
});
