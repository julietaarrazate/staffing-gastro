import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToastProvider, useToast } from "./Toast";

function Trigger({ message, tone }: { message: string; tone?: "success" | "error" | "info" }) {
  const show = useToast();
  return (
    <button type="button" onClick={() => show(message, tone)}>
      disparar
    </button>
  );
}

describe("ToastProvider", () => {
  it("el contenedor de toasts es una región viva anunciable por lector de pantalla", () => {
    render(
      <ToastProvider>
        <Trigger message="Turno publicado" />
      </ToastProvider>
    );
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
  });

  it("un toast disparado aparece dentro de la región viva, no fuera de ella", async () => {
    render(
      <ToastProvider>
        <Trigger message="Turno publicado" />
      </ToastProvider>
    );
    screen.getByRole("button", { name: "disparar" }).click();

    const region = screen.getByRole("status");
    await waitFor(() => expect(region).toHaveTextContent("Turno publicado"));
  });

  it("ni el contenedor ni el cuerpo del aviso reciben toques: no tapan lo que hay debajo", async () => {
    render(
      <ToastProvider>
        <Trigger message="Turno publicado" />
      </ToastProvider>
    );
    screen.getByRole("button", { name: "disparar" }).click();

    const region = screen.getByRole("status");
    await waitFor(() => expect(region).toHaveTextContent("Turno publicado"));
    const cuerpo = screen.getByText("Turno publicado");

    expect(region.classList.contains("pointer-events-none")).toBe(true);
    expect(cuerpo.classList.contains("pointer-events-none")).toBe(true);
    expect(cuerpo.classList.contains("pointer-events-auto")).toBe(false);
    // Un botón de acción dentro del aviso sí recibe toques (hoy ningún aviso
    // lo tiene; la regla queda lista para cuando haya uno).
    expect(cuerpo.className).toContain("[&_button]:pointer-events-auto");
  });
});
