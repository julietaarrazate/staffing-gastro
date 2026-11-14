import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Modal from "./Modal";

// Quién recibe el toque mientras el diálogo sale lo prueba el e2e
// (`e2e/segundo-toque-trabajador.spec.ts`); acá, el contrato de la capa.
function dialog(open: boolean, onClose = () => {}) {
  return (
    <Modal open={open} onClose={onClose} title="¿Seguro?">
      <button type="button">Sí</button>
    </Modal>
  );
}

describe("Modal", () => {
  it("mientras se cierra, el diálogo queda inert y el velo no cierra nada", async () => {
    const onClose = vi.fn();
    const { rerender } = render(dialog(true, onClose));
    expect(screen.getByRole("dialog")).not.toHaveProperty("inert", true);

    rerender(dialog(false, onClose));
    const enSalida = screen.getByRole("dialog", { hidden: true });
    await waitFor(() => expect(enSalida).toHaveProperty("inert", true));
    // La capa sigue ahí (se traga el toque) y el velo ya no dispara onClose.
    const velo = enSalida.parentElement!.firstElementChild as HTMLElement;
    fireEvent.click(velo);
    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog", { hidden: true })).toBeNull());
  });

  it("abierto, tocar el velo cierra", () => {
    const onClose = vi.fn();
    render(dialog(true, onClose));
    fireEvent.click(screen.getByRole("dialog").parentElement!.firstElementChild as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
