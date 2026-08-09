import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { useFocusTrap } from "./use-focus-trap";

function TestDialog({ initialOpen = true }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, open);

  return (
    <div>
      <button onClick={() => setOpen(true)}>Abrir</button>
      <button>Botón de fondo (no debería recibir foco con Tab)</button>
      {open && (
        <div ref={ref} role="dialog" aria-modal="true">
          <button onClick={() => setOpen(false)}>Cerrar</button>
          <button>Primero</button>
          <button>Segundo</button>
        </div>
      )}
    </div>
  );
}

describe("useFocusTrap", () => {
  it("al abrir, mueve el foco al primer elemento focuseable adentro del diálogo", () => {
    render(<TestDialog />);
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveFocus();
  });

  it("Tab desde el último elemento vuelve al primero (no se escapa del diálogo)", async () => {
    const user = userEvent.setup();
    render(<TestDialog />);

    await user.tab(); // Cerrar -> Primero
    await user.tab(); // Primero -> Segundo
    expect(screen.getByRole("button", { name: "Segundo" })).toHaveFocus();
    await user.tab(); // Segundo -> vuelve a Cerrar (no al botón de fondo)
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveFocus();
  });

  it("Shift+Tab desde el primer elemento va al último (recorrido inverso)", async () => {
    const user = userEvent.setup();
    render(<TestDialog />);

    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Segundo" })).toHaveFocus();
  });

  it("al cerrar, restaura el foco al elemento que estaba enfocado antes de abrir", async () => {
    const user = userEvent.setup();
    render(<TestDialog initialOpen={false} />);

    const openButton = screen.getByRole("button", { name: "Abrir" });
    openButton.focus();
    await user.click(openButton);
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(openButton).toHaveFocus();
  });
});
