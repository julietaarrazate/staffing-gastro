import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Shift, ShiftStatus } from "@/lib/types";
import ShiftActions from "./ShiftActions";

/**
 * El botón principal de la tarjeta cambia de acción con el estado del turno,
 * siempre en el mismo lugar. Acá se fija a dónde va cada toque: «Marcar como
 * pagado» nunca dispara la acción directa (pide confirmación) y, con la guarda
 * activa, ningún botón de acción acepta toques. El recorrido completo, con
 * los tiempos de un doble toque real, está en
 * `e2e/shifts-panel-doble-toque.spec.ts`.
 */

vi.mock("@/components/ShareShiftButton", () => ({ default: () => null }));

const MIN = 60_000;

/** Por defecto el turno empezó hace 20 minutos (ya se puede marcar la ausencia). */
function shift(status: ShiftStatus, startedMinutesAgo: number): Shift {
  const start_at = new Date(Date.now() - startedMinutesAgo * MIN).toISOString();
  return { id: "turno-1", status, worker_profile_id: "wp-1", start_at } as Shift;
}

function setup(
  status: ShiftStatus,
  { locked = false, startedMinutesAgo = 20 }: { locked?: boolean; startedMinutesAgo?: number } = {},
) {
  const handlers = {
    onRun: vi.fn(),
    onMarkPaid: vi.fn(),
    onNoShow: vi.fn(),
    onCancel: vi.fn(),
  };
  const { unmount } = render(
    <ShiftActions shift={shift(status, startedMinutesAgo)} busy={null} locked={locked} {...handlers} />,
  );
  return { ...handlers, unmount };
}

describe("ShiftActions", () => {
  it("«Cerrar turno» dispara el cierre del turno", () => {
    const { onRun, onMarkPaid } = setup("check_out");

    fireEvent.click(screen.getByRole("button", { name: "Cerrar turno" }));

    expect(onRun).toHaveBeenCalledExactlyOnceWith("turno-1", "finish");
    expect(onMarkPaid).not.toHaveBeenCalled();
  });

  it("«Marcar como pagado» pide confirmación en vez de registrar el pago", () => {
    const { onRun, onMarkPaid } = setup("finalizado");

    fireEvent.click(screen.getByRole("button", { name: "Marcar como pagado" }));

    expect(onMarkPaid).toHaveBeenCalledTimes(1);
    expect(onRun).not.toHaveBeenCalled();
  });

  it("con la guarda activa, el botón principal no acepta toques", () => {
    const { onRun, onMarkPaid } = setup("finalizado", { locked: true });

    const button = screen.getByRole("button", { name: "Marcar como pagado" });
    expect(button).toBeDisabled();
    fireEvent.click(button);

    expect(onMarkPaid).not.toHaveBeenCalled();
    expect(onRun).not.toHaveBeenCalled();
  });

  it("con la guarda activa, tampoco se abren las confirmaciones del menú «Más»", () => {
    const { onNoShow, onCancel } = setup("confirmado", { locked: true });

    fireEvent.click(screen.getByRole("button", { name: "Más acciones" }));
    const noShow = screen.getByRole("button", { name: /No se presentó/ });
    const cancel = screen.getByRole("button", { name: "Cancelar turno" });
    expect(noShow).toBeDisabled();
    expect(cancel).toBeDisabled();
    fireEvent.click(noShow);
    fireEvent.click(cancel);

    expect(onNoShow).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("«No se presentó» no se ofrece en un turno que todavía no empezó ni antes de los 15 minutos", () => {
    for (const startedMinutesAgo of [-24 * 60, -5, 0, 14]) {
      const { unmount } = setup("confirmado", { startedMinutesAgo });
      fireEvent.click(screen.getByRole("button", { name: "Más acciones" }));
      expect(screen.queryByRole("button", { name: /No se presentó/ })).toBeNull();
      expect(screen.getByRole("button", { name: "Cancelar turno" })).toBeInTheDocument();
      unmount();
    }
  });

  it("«No se presentó» aparece a los 15 minutos del inicio, también con el trabajador en camino", () => {
    for (const status of ["confirmado", "en_camino"] as const) {
      const { unmount } = setup(status, { startedMinutesAgo: 15 });
      fireEvent.click(screen.getByRole("button", { name: "Más acciones" }));
      expect(screen.getByRole("button", { name: /No se presentó/ })).toBeInTheDocument();
      unmount();
    }
  });
});
