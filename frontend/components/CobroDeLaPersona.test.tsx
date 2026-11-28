import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Shift } from "@/lib/types";
import CobroDeLaPersona from "./CobroDeLaPersona";
import CobroEnElTurno from "./CobroEnElTurno";

const post = vi.fn();

vi.mock("@/lib/api", async (orig) => {
  const real = await orig<typeof import("@/lib/api")>();
  return { ...real, api: { ...real.api, post: (...a: unknown[]) => post(...a) } };
});
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ token: "tok" }) }));

beforeEach(() => post.mockReset());

const AHORA = new Date("2026-11-27T20:00:00Z");
const turno = (extra: Partial<Shift> = {}) =>
  ({
    id: "s1",
    paid_at: null,
    worker_confirmed_paid_at: null,
    worker_reported_unpaid_at: null,
    unpaid_report_opens_at: "2026-11-28T03:58:00Z",
    ...extra,
  }) as Shift;

describe("CobroDeLaPersona", () => {
  it("antes del plazo: «Todavía no» apagado y explica cuándo", () => {
    render(<CobroDeLaPersona shift={turno()} now={AHORA} onChanged={vi.fn()} />);
    expect(screen.getByText("¿Ya cobraste este turno?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Todavía no" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sí, cobré" })).toBeEnabled();
    expect(screen.getByText(/el 28\/11 a las 00:58/)).toBeInTheDocument();
  });

  it("«Sí, cobré» pega al endpoint y recarga", async () => {
    post.mockResolvedValue({});
    const onChanged = vi.fn();
    render(<CobroDeLaPersona shift={turno()} now={AHORA} onChanged={onChanged} />);
    await userEvent.click(screen.getByRole("button", { name: "Sí, cobré" }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(post.mock.calls[0][0]).toBe("/shifts/s1/payment-received");
  });

  it("con el pago del comercio, «Todavía no» se puede enseguida", async () => {
    post.mockResolvedValue({});
    const shift = turno({ paid_at: "2026-11-27T19:00:00Z", unpaid_report_opens_at: "2026-11-27T19:00:00Z" });
    render(<CobroDeLaPersona shift={shift} now={AHORA} onChanged={vi.fn()} />);
    expect(screen.getByText("El comercio marcó este turno como pagado.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Todavía no" }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][0]).toBe("/shifts/s1/payment-missing");
  });

  it("estados posteriores", () => {
    const { rerender } = render(
      <CobroDeLaPersona shift={turno({ worker_confirmed_paid_at: "x" })} now={AHORA} onChanged={vi.fn()} />,
    );
    expect(screen.getByText("Confirmaste el cobro")).toBeInTheDocument();
    rerender(<CobroDeLaPersona shift={turno({ worker_reported_unpaid_at: "x" })} now={AHORA} onChanged={vi.fn()} />);
    expect(screen.getByText("Avisaste que no cobraste: soporte ya lo sabe")).toBeInTheDocument();
    // Después de avisar todavía puede confirmar.
    expect(screen.getByRole("button", { name: "Sí, cobré" })).toBeEnabled();
  });
});

describe("CobroEnElTurno", () => {
  it("nada si la persona no dijo nada", () => {
    const { container } = render(<CobroEnElTurno shift={turno({ worker_name: "Lucía" })} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("confirmó", () => {
    render(<CobroEnElTurno shift={turno({ worker_name: "Lucía", worker_confirmed_paid_at: "x" })} />);
    expect(screen.getByText("Lucía confirmó que cobró")).toBeInTheDocument();
  });
  it("avisó que no cobró", () => {
    render(<CobroEnElTurno shift={turno({ worker_name: "Lucía", worker_reported_unpaid_at: "x" })} />);
    expect(screen.getByTestId("cobro-del-turno")).toHaveTextContent("Lucía avisó que todavía no cobró");
  });
});
