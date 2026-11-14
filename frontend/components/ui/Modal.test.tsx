import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Modal from "./Modal";

function dialog(open: boolean) {
  return (
    <Modal open={open} onClose={() => {}} title="¿Seguro?">
      <button type="button">Sí</button>
    </Modal>
  );
}

describe("Modal", () => {
  it("mientras se cierra, su contenido no recibe toques", async () => {
    const { rerender } = render(dialog(true));
    const abierta = screen.getByRole("dialog").parentElement!;
    expect(abierta).not.toHaveClass("pointer-events-none");

    rerender(dialog(false));
    // La animación de salida lo mantiene en pantalla un instante: ahí no toca.
    const enSalida = screen.queryByRole("dialog", { hidden: true });
    expect(enSalida).not.toBeNull();
    expect(enSalida!.parentElement).toHaveClass("pointer-events-none");
    await waitFor(() => expect(screen.queryByRole("dialog", { hidden: true })).toBeNull());
  });
});
