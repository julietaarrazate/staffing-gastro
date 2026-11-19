import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CerrarTurnoDialog, { type CerrarTurnoTarget } from "./CerrarTurnoDialog";
import { ApiError } from "@/lib/api";
import type { TapGuard } from "@/lib/use-tap-guard";

const apiPost = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { post: (...args: unknown[]) => apiPost(...args) } };
});

const TARGET: CerrarTurnoTarget = {
  id: "s1",
  name: "Mozo para el sábado",
  action: { check_out: true, finish: false, notifies: "company" },
};

// 21:40 en Argentina (UTC-3).
const AHORA = new Date("2026-11-19T00:40:00Z");

function guard(locked = false): TapGuard {
  return { locked, run: async (action) => (await action(), true) };
}

beforeEach(() => {
  apiPost.mockReset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AHORA);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("CerrarTurnoDialog (decisión 21)", () => {
  it("un error que no es 409 no recarga la ficha", async () => {
    apiPost.mockRejectedValue(new ApiError(500, "Algo falló"));
    const onChanged = vi.fn();
    render(
      <CerrarTurnoDialog target={TARGET} token="tok" tapGuard={guard()} onClose={vi.fn()} onChanged={onChanged} />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sí, cerrar turno" }));
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Algo falló");
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("antes de confirmar dice qué va a pasar, con la hora de ahora", () => {
    render(
      <CerrarTurnoDialog target={TARGET} token="tok" tapGuard={guard()} onClose={vi.fn()} onChanged={vi.fn()} />
    );

    expect(screen.getByRole("dialog", { name: "¿Cerrar «Mozo para el sábado»?" })).toBeInTheDocument();
    expect(screen.getByText("Marcamos la salida de la persona a las 21:40, en su nombre.")).toBeInTheDocument();
    expect(
      screen.getByText("Le avisamos al comercio para que cierre el turno, como siempre.")
    ).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();
  });

  it("al confirmar cierra por la API y muestra el resultado", async () => {
    apiPost.mockResolvedValue({
      shift_id: "s1",
      status: "check_out",
      check_out: true,
      finish: false,
      notifies: "company",
      checked_out_at: "2026-11-19T00:40:12Z",
    });
    const onChanged = vi.fn();
    render(
      <CerrarTurnoDialog target={TARGET} token="tok" tapGuard={guard()} onClose={vi.fn()} onChanged={onChanged} />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sí, cerrar turno" }));
    });

    // Manda lo que la admin vio y confirmó.
    expect(apiPost).toHaveBeenCalledWith(
      "/admin/shifts/s1/close",
      { check_out: true, finish: false },
      "tok"
    );
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText("Marcamos la salida a las 21:40. Le avisamos al comercio para que lo cierre.")
    ).toBeInTheDocument();
  });

  it("si no aplica (409) muestra el motivo y deja volver", async () => {
    apiPost.mockRejectedValue(
      new ApiError(
        409,
        "La salida ya está marcada y el comercio tiene la cuenta activa: el turno lo cierra el comercio."
      )
    );
    const onClose = vi.fn();
    const onChanged = vi.fn();
    render(
      <CerrarTurnoDialog target={TARGET} token="tok" tapGuard={guard()} onClose={onClose} onChanged={onChanged} />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sí, cerrar turno" }));
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "La salida ya está marcada y el comercio tiene la cuenta activa"
    );
    // La ficha se recarga para mostrar cómo quedó el turno.
    expect(onChanged).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Volver" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("con la pantalla asentándose no se puede confirmar (toque de más)", () => {
    render(
      <CerrarTurnoDialog target={TARGET} token="tok" tapGuard={guard(true)} onClose={vi.fn()} onChanged={vi.fn()} />
    );

    expect(screen.getByRole("button", { name: "Sí, cerrar turno" })).toBeDisabled();
  });
});
