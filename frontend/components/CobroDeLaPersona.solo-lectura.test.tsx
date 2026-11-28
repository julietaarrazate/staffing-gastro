import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Shift } from "@/lib/types";
import CobroDeLaPersona from "./CobroDeLaPersona";

vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ token: "tok" }) }));

afterEach(() => vi.unstubAllGlobals());

describe("CobroDeLaPersona bajo «Ver como»", () => {
  it("el 403 `impersonation_read_only` se muestra como mensaje y los botones siguen sanos", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: {
            code: "impersonation_read_only",
            message: "Estás viendo esta cuenta en sólo lectura: no se puede cambiar nada.",
          },
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const shift = {
      id: "s1",
      paid_at: null,
      worker_confirmed_paid_at: null,
      worker_reported_unpaid_at: null,
      unpaid_report_opens_at: "2026-11-28T03:58:00Z",
    } as Shift;
    const onChanged = vi.fn();
    render(<CobroDeLaPersona shift={shift} now={new Date("2026-11-27T20:00:00Z")} onChanged={onChanged} />);

    await userEvent.click(screen.getByRole("button", { name: "Sí, cobré" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("sólo lectura");
    expect(fetchMock.mock.calls[0][0]).toContain("/shifts/s1/payment-received");
    expect(screen.getByRole("button", { name: "Sí, cobré" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Todavía no" })).toBeDisabled();
  });
});
