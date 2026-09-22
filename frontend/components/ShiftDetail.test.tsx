import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ShiftPublic } from "@/lib/types";
import ShiftDetail from "./ShiftDetail";

/**
 * La acción del detalle de turno cambia según quién lo mira. El bug que motivó
 * este test: la página le decía "Postulate en Oído" (→ registro) a un
 * trabajador ya logueado que llegaba tocando un turno del home. `/turno/[id]`
 * se arma en el servidor, así que Playwright (API mockeada sólo en el
 * navegador) no puede cubrirlo: acá se prueba el componente.
 */

const auth = vi.hoisted(() => ({
  value: { user: null as null | { role: string }, token: null as null | string, loading: false },
}));
const get = vi.fn();
const post = vi.fn();

vi.mock("@/lib/auth-context", () => ({ useAuth: () => auth.value }));
vi.mock("@/lib/push-prompt-context", () => ({ usePushPrompt: () => ({ requestOptIn: vi.fn() }) }));
vi.mock("@/components/ui", () => ({
  Skeleton: () => <div data-testid="skeleton" />,
  useToast: () => vi.fn(),
}));
vi.mock("@/components/MiniMap", () => ({ default: () => null }));
vi.mock("@/components/worker/SaveShiftButton", () => ({ default: () => null }));
vi.mock("@/components/ShareShiftButton", () => ({ default: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn() }) }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
  },
}));

const SHIFT: ShiftPublic = {
  id: "s1",
  position: "mozo",
  start_at: "2026-09-26T23:00:00Z",
  end_at: "2026-09-27T05:00:00Z",
  city: "Palermo",
  pay_amount: "42000.00",
  currency: "ARS",
  company_name: "Tinto",
};

function mockGets(applications: { shift_id: string }[]) {
  get.mockImplementation((path: string) => {
    if (path.startsWith("/applications/mine")) return Promise.resolve(applications);
    if (path === "/shifts/s1") return Promise.resolve({ ...SHIFT, tips: true, meal: false, dress_code: null });
    return Promise.reject(new Error(`sin mock: ${path}`));
  });
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  auth.value = { user: null, token: null, loading: false };
});

describe("ShiftDetail", () => {
  it("sin sesión, la acción lleva al registro con el rol de trabajador elegido", () => {
    render(<ShiftDetail publicShift={SHIFT} />);

    const link = screen.getByRole("link", { name: "Postulate en Oído" });
    expect(link).toHaveAttribute("href", "/register?rol=trabajador");
    expect(get).not.toHaveBeenCalled();
  });

  it("un trabajador logueado se postula ahí mismo, sin pasar por el registro", async () => {
    auth.value = { user: { role: "worker" }, token: "tok", loading: false };
    mockGets([]);
    post.mockResolvedValue({ id: "a1" });
    const user = userEvent.setup();
    render(<ShiftDetail publicShift={SHIFT} />);

    await user.click(await screen.findByRole("button", { name: "Postularme" }));

    expect(post).toHaveBeenCalledWith("/applications/shifts/s1", undefined, "tok", undefined, expect.any(String));
    expect(await screen.findByText("Ya te postulaste")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Postulate en Oído" })).not.toBeInTheDocument();
  });

  it("si ya estaba postulado, no le ofrece postularse de nuevo", async () => {
    auth.value = { user: { role: "worker" }, token: "tok", loading: false };
    mockGets([{ shift_id: "s1" }]);
    render(<ShiftDetail publicShift={SHIFT} />);

    expect(await screen.findByText("Ya te postulaste")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Postularme" })).not.toBeInTheDocument();
  });

  it("con sesión suma lo que la vista pública no trae (las condiciones)", async () => {
    auth.value = { user: { role: "worker" }, token: "tok", loading: false };
    mockGets([]);
    render(<ShiftDetail publicShift={SHIFT} />);

    await waitFor(() => expect(screen.getByText("Qué incluye")).toBeInTheDocument());
    expect(screen.getByText("Propinas")).toBeInTheDocument();
  });
});
