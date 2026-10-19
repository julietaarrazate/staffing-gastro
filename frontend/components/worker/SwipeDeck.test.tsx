import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Shift } from "@/lib/types";
import SwipeDeck from "./SwipeDeck";

// Sin animaciones: el mazo usa duración 0 cuando el usuario pide menos movimiento.
vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  useReducedMotion: () => true,
}));

const shifts = ["a", "b", "c"].map((id) => ({ id }) as Shift);

function renderDeck(onApply = vi.fn(async () => true)) {
  render(
    <SwipeDeck
      shifts={shifts}
      onApply={onApply}
      renderCard={(s) => <div>Turno {s.id}</div>}
      empty={<div>Sin turnos</div>}
    />
  );
  return onApply;
}

describe("SwipeDeck", () => {
  it("recorrer el mazo no postula ni descarta nada", async () => {
    const onApply = renderDeck();
    const position = screen.getByTestId("swipe-deck-position");
    expect(position).toHaveTextContent("1 de 3");
    expect(screen.getByRole("button", { name: "Turno anterior" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Turno siguiente" }));
    await waitFor(() => expect(position).toHaveTextContent("2 de 3"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Turno anterior" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Turno anterior" }));
    await waitFor(() => expect(position).toHaveTextContent("1 de 3"));

    expect(onApply).not.toHaveBeenCalled();
  });

  it("postularse es explícito y saca sólo ese turno del mazo", async () => {
    const onApply = renderDeck();
    await userEvent.click(screen.getByRole("button", { name: "Turno siguiente" }));
    await waitFor(() => expect(screen.getByTestId("swipe-deck-position")).toHaveTextContent("2 de 3"));

    await userEvent.click(screen.getByRole("button", { name: "Postularme" }));
    await waitFor(() => expect(onApply).toHaveBeenCalledWith(shifts[1]));
    // El índice queda en el lugar: ahora muestra el turno siguiente.
    await waitFor(() => expect(screen.getByTestId("swipe-deck-position")).toHaveTextContent("2 de 2"));
  });

  it("si la postulación falla, el turno vuelve a su lugar", async () => {
    const onApply = renderDeck(vi.fn(async () => false));
    await userEvent.click(screen.getByRole("button", { name: "Postularme" }));
    await waitFor(() => expect(onApply).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId("swipe-deck-position")).toHaveTextContent("1 de 3"));
  });
});
