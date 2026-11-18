import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BottomNav from "./BottomNav";

let auth: Record<string, unknown>;
vi.mock("@/lib/auth-context", () => ({ useAuth: () => auth }));
vi.mock("next/navigation", () => ({ usePathname: () => "/admin/seguridad" }));

describe("BottomNav", () => {
  it("al admin con el alta de 2FA pendiente no le muestra la barra (U133)", () => {
    auth = { user: { role: "admin" }, loading: false, twoFactorSetupPending: true };
    render(<BottomNav />);
    expect(screen.queryByRole("navigation", { name: "Secciones" })).not.toBeInTheDocument();
  });

  it("con el alta resuelta la barra sigue", () => {
    auth = { user: { role: "admin" }, loading: false, twoFactorSetupPending: false };
    render(<BottomNav />);
    expect(screen.getByRole("navigation", { name: "Secciones" })).toBeInTheDocument();
  });
});
