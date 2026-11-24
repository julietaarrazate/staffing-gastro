import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ShiftPublic } from "@/lib/types";
import ShiftDetail from "./ShiftDetail";

/**
 * Escritorio, renglón 12: la prueba de Playwright del detalle del turno no
 * corre en CI (la página se arma en el servidor), así que acá se cuida que la
 * disposición en dos columnas desde `lg` siga en el DOM: la portada al lado de
 * la hoja, y el celular sin tocar (las clases base).
 */
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ user: null, token: null, loading: false }) }));
vi.mock("@/lib/push-prompt-context", () => ({ usePushPrompt: () => ({ requestOptIn: vi.fn() }) }));
vi.mock("@/lib/live-refresh", () => ({ useLiveRefresh: () => {} }));
vi.mock("@/components/ui", async (orig) => ({ ...(await orig<object>()), useToast: () => vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));
vi.mock("@/lib/letras", () => ({ LETRAS_APP: "" }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));

const SHIFT: ShiftPublic = {
  id: "3f2b8c1e-5a47-4d09-9c1b-7e6a2d4f8b10",
  position: "mozo",
  start_at: "2026-12-10T23:00:00Z",
  end_at: "2026-12-11T04:00:00Z",
  city: "Palermo",
  pay_amount: "42000.00",
  currency: "ARS",
  company_name: "Tinto",
  tips: true,
  meal: false,
  dress_code: null,
  urgent: true,
};

describe("ShiftDetail en la compu", () => {
  it("la portada y la hoja van en dos columnas desde lg, y en una sola en el celular", () => {
    const { container } = render(<ShiftDetail publicShift={SHIFT} />);
    const raiz = container.firstElementChild as HTMLElement;
    expect(raiz.className).toMatch(/\blg:grid\b/);
    expect(raiz.className).toMatch(/lg:grid-cols-\[minmax\(0,2fr\)_minmax\(0,3fr\)\]/);
    expect(raiz.className).toMatch(/lg:max-w-\[var\(--app-frame\)\]/);
    expect(raiz.className).toMatch(/\bflex flex-col\b/);
    const portada = container.querySelector("header") as HTMLElement;
    expect(portada.className).toMatch(/lg:h-auto/);
    const hoja = screen.getByRole("region", { name: "El turno" });
    expect(hoja.className).toMatch(/lg:mt-0/);
  });
});
