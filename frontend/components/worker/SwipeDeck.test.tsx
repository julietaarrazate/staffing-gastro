import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Shift } from "@/lib/types";
import SwipeDeck, { huboArrastre } from "./SwipeDeck";

// Sin animaciones: el mazo usa duración 0 cuando el usuario pide menos movimiento.
vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  useReducedMotion: () => true,
}));

const shifts = ["a", "b", "c"].map((id) => ({ id }) as Shift);

function renderDeck(onApply = vi.fn(async () => true), onOpen = vi.fn()) {
  render(
    <SwipeDeck
      shifts={shifts}
      onApply={onApply}
      onOpen={onOpen}
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

  it("un segundo toque en «Postularme» no postula la carta que quedó debajo", async () => {
    const onApply = renderDeck();
    const boton = screen.getByRole("button", { name: "Postularme" });
    await userEvent.click(boton);
    await waitFor(() => expect(screen.getByTestId("swipe-deck-position")).toHaveTextContent("1 de 2"));
    // Pasaron las animaciones, pero la pantalla todavía se está asentando.
    expect(boton).toBeDisabled();
    fireEvent.click(boton);
    await userEvent.click(boton);
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("swipe-deck-position")).toHaveTextContent("1 de 2");
  });
});

describe("SwipeDeck: toque vs arrastre (U069)", () => {
  it("huboArrastre: hasta 8 px es toque, más es arrastre", () => {
    expect(huboArrastre({ x: 10, y: 10 }, { x: 14, y: 14 })).toBe(false);
    expect(huboArrastre({ x: 10, y: 10 }, { x: 30, y: 10 })).toBe(true);
    expect(huboArrastre({ x: 10, y: 10 }, { x: 10, y: 25 })).toBe(true);
    expect(huboArrastre(null, { x: 99, y: 99 })).toBe(false);
  });

  it("teclado y lector de pantalla abren el detalle con el botón", async () => {
    const onOpen = vi.fn();
    renderDeck(undefined, onOpen);
    await userEvent.click(screen.getByRole("button", { name: "Ver el detalle del turno" }));
    expect(onOpen).toHaveBeenCalledWith(shifts[0]);
  });
});
