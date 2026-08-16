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
});
