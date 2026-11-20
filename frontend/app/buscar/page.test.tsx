import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emitLiveRefresh, LIVE_REFRESH_DEBOUNCE_MS } from "@/lib/live-refresh";
import type { Shift } from "@/lib/types";
import BuscarPage from "./page";

/**
 * Buscar se pone al día con los avisos (VIE-03) sin deshacer lo que la persona
 * ya hizo: un turno descartado o al que se postuló no vuelve con la recarga, y
 * una respuesta vieja no pisa a una más nueva.
 */

const get = vi.fn();
const post = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) },
}));
vi.mock("@/lib/use-require-auth", () => ({ useRequireAuth: () => ({ token: "tok" }) }));
vi.mock("@/lib/push-prompt-context", () => ({ usePushPrompt: () => ({ requestOptIn: vi.fn() }) }));
vi.mock("@/lib/current-location", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/current-location")>()),
  getStoredLocation: () => null,
}));
vi.mock("@/components/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui")>()),
  useToast: () => vi.fn(),
}));
vi.mock("@/components/worker/OportunidadFila", () => ({
  default: ({ shift, onApply, onPass }: { shift: Shift; onApply: () => void; onPass: () => void }) => (
    <div>
      <span>{shift.company_name}</span>
      <button onClick={onApply}>Postularme a {shift.company_name}</button>
      <button onClick={onPass}>Pasar {shift.company_name}</button>
    </div>
  ),
}));

const turno = (id: string, company: string) =>
  ({ id, company_name: company, position: "mozo", urgent: false, pay_amount: "1000", currency: "ARS" }) as unknown as Shift;
const A = turno("a", "Bar Alfa");
const B = turno("b", "Bar Beta");

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
});

const recargar = () =>
  act(async () => {
    emitLiveRefresh();
    await new Promise((r) => setTimeout(r, LIVE_REFRESH_DEBOUNCE_MS + 100));
  });

describe("Buscar", () => {
  it("un turno descartado con «pass» no reaparece cuando llega una recarga silenciosa", async () => {
    get.mockImplementation((path: string) => {
      if (path.startsWith("/shifts/feed")) return Promise.resolve([A, B]);
      if (path.startsWith("/applications/mine")) return Promise.resolve([]);
      return Promise.resolve(null);
    });
    const user = userEvent.setup();
    render(<BuscarPage />);
    await user.click(await screen.findByRole("button", { name: "Pasar Bar Alfa" }));
    expect(screen.queryByText("Bar Alfa")).not.toBeInTheDocument();

    await recargar(); // el servidor sigue trayendo Alfa
    expect(get.mock.calls.filter(([p]) => String(p).startsWith("/shifts/feed")).length).toBeGreaterThan(1);
    expect(screen.queryByText("Bar Alfa")).not.toBeInTheDocument();
    expect(screen.getByText("Bar Beta")).toBeInTheDocument();
  });

  it("una recarga que salió antes de postularse no vuelve a poner el turno postulado", async () => {
    let lentas: Array<(v: Shift[]) => void> = [];
    let primera = true;
    get.mockImplementation((path: string) => {
      if (path.startsWith("/shifts/feed")) {
        if (primera) {
          primera = false;
          return Promise.resolve([A, B]);
        }
        return new Promise((res) => lentas.push(res)); // la recarga queda en vuelo
      }
      if (path.startsWith("/applications/mine")) return Promise.resolve([]);
      return Promise.resolve(null);
    });
    post.mockResolvedValue({ id: "x" });
    const user = userEvent.setup();
    render(<BuscarPage />);
    await screen.findByText("Bar Alfa");

    await recargar();
    await waitFor(() => expect(lentas.length).toBe(1));
    await user.click(screen.getByRole("button", { name: "Postularme a Bar Alfa" }));
    await waitFor(() => expect(screen.queryByText("Bar Alfa")).not.toBeInTheDocument());

    await act(async () => lentas[0]([A, B])); // llega la respuesta vieja, con Alfa
    expect(screen.queryByText("Bar Alfa")).not.toBeInTheDocument();
    lentas = [];
  });
});
