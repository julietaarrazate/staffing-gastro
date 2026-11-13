import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { isCancellable } from "@/lib/cancelar-turno";
import type { Shift, ShiftStatus } from "@/lib/types";
import ShiftActions from "./ShiftActions";

/**
 * «Cancelar turno» sólo se ofrece desde los estados en los que el dominio deja
 * cancelar (`Shift.cancel()`: cualquiera que no sea terminal). Un turno «No
 * cubierto» lo ofrecía y al confirmar salía el error crudo del servidor.
 */

vi.mock("@/components/ShareShiftButton", () => ({ default: () => null }));

const CANCELLABLE: ShiftStatus[] = [
  "borrador",
  "publicado",
  "buscando_personal",
  "asignado",
  "confirmado",
  "en_camino",
  "check_in",
  "trabajando",
  "check_out",
];
// Los terminales del dominio (`TERMINAL_STATUSES`): no admiten más transiciones.
const NOT_CANCELLABLE: ShiftStatus[] = ["finalizado", "pagado", "cancelado", "no_cubierto"];

function openMenu(status: ShiftStatus) {
  render(
    <ShiftActions
      shift={{ id: "turno-1", status, worker_profile_id: null } as Shift}
      busy={null}
      locked={false}
      onRun={vi.fn()}
      onMarkPaid={vi.fn()}
      onNoShow={vi.fn()}
      onCancel={vi.fn()}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "Más acciones" }));
}

describe("ShiftActions · «Cancelar turno»", () => {
  it.each(CANCELLABLE)("%s: se ofrece", (status) => {
    openMenu(status);
    expect(screen.getByRole("button", { name: "Cancelar turno" })).toBeInTheDocument();
  });

  it.each(NOT_CANCELLABLE)("%s: no se ofrece", (status) => {
    openMenu(status);
    expect(screen.queryByRole("button", { name: "Cancelar turno" })).toBeNull();
  });

  it("la lista del menú y la del diálogo (`isCancellable`) dicen lo mismo", () => {
    for (const status of CANCELLABLE) expect(isCancellable(status)).toBe(true);
    for (const status of NOT_CANCELLABLE) expect(isCancellable(status)).toBe(false);
  });
});
