import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Modal, Sheet } from "@/components/ui";
import { PushPromptProvider, usePushPrompt } from "@/lib/push-prompt-context";
import GuidedTour from "@/components/GuidedTour";
import ShiftPublishedNextSteps from "@/components/ShiftPublishedNextSteps";
import { useEscapeLayer } from "./use-escape-layer";

vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ token: "t" }) }));
vi.mock("@/lib/push", () => ({
  isPushSupported: () => true,
  subscribeToPush: vi.fn(),
}));

function Layer({ label, priority }: { label: string; priority?: number }) {
  const [open, setOpen] = useState(true);
  useEscapeLayer(open, () => setOpen(false), priority);
  return open ? <p>{label}</p> : null;
}

describe("useEscapeLayer", () => {
  it("con dos capas apiladas, Escape cierra sólo la de arriba; el segundo cierra la otra", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Layer label="abajo" />
        <Layer label="arriba" />
      </>
    );
    await user.keyboard("{Escape}");
    expect(screen.getByText("abajo")).toBeInTheDocument();
    expect(screen.queryByText("arriba")).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByText("abajo")).not.toBeInTheDocument();
  });

  it("la prioridad manda sobre el orden de apertura", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Layer label="alta" priority={60} />
        <Layer label="baja" priority={50} />
      </>
    );
    await user.keyboard("{Escape}");
    expect(screen.queryByText("alta")).not.toBeInTheDocument();
    expect(screen.getByText("baja")).toBeInTheDocument();
  });

  it("Modal encima de Sheet: Escape cierra sólo el Modal (se afirma sobre onClose, no sobre el DOM, porque la animación de salida deja la hoja un rato)", async () => {
    const user = userEvent.setup();
    const closeSheet = vi.fn();
    const closeModal = vi.fn();
    render(
      <>
        <Sheet open onClose={closeSheet} title="Hoja">
          <p>contenido hoja</p>
        </Sheet>
        <Modal open onClose={closeModal} title="Diálogo">
          <p>contenido diálogo</p>
        </Modal>
      </>
    );
    await user.keyboard("{Escape}");
    expect(closeModal).toHaveBeenCalledTimes(1);
    expect(closeSheet).not.toHaveBeenCalled();
  });

  it("Un Escape mantenido apretado (repetición automática) no baja a la capa de abajo", async () => {
    const onTop = vi.fn();
    const onBottom = vi.fn();
    function Dos() {
      useEscapeLayer(true, onBottom);
      useEscapeLayer(true, onTop);
      return null;
    }
    render(<Dos />);
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.keyDown(document, { key: "Escape", repeat: true });
    fireEvent.keyDown(document, { key: "Escape", repeat: true });
    expect(onTop).toHaveBeenCalledTimes(1);
    expect(onBottom).not.toHaveBeenCalled();
  });

  it("una capa con prioridad 70 (recorrido guiado) tapa a un Sheet: Escape no llega al pedido de abajo", async () => {
    const user = userEvent.setup();
    const closeSheet = vi.fn();
    localStorage.clear();
    // jsdom no implementa scrollIntoView, que el recorrido usa al medir el paso.
    Element.prototype.scrollIntoView = vi.fn();
    render(
      <>
        <Sheet open onClose={closeSheet} title="Hoja">
          <p>contenido hoja</p>
        </Sheet>
        <GuidedTour steps={[{ target: "#ancla", title: "Paso", body: "Cuerpo" }]} storageKey="k_test" />
        <div id="ancla" />
      </>
    );
    await screen.findByRole("dialog", { name: "Paso" });
    await user.keyboard("{Escape}");
    expect(closeSheet).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Paso" })).not.toBeInTheDocument());
    expect(localStorage.getItem("k_test")).toBe("1");
    await user.keyboard("{Escape}");
    expect(closeSheet).toHaveBeenCalledTimes(1);
  });

  it("publicar un turno: Escape cierra la confirmación y el pedido de notificaciones sigue disponible, sin quedar rechazado", async () => {
    localStorage.clear();
    const user = userEvent.setup();
    function Publicar() {
      const { requestOptIn } = usePushPrompt();
      const [published, setPublished] = useState(false);
      return (
        <>
          <button
            onClick={() => {
              requestOptIn();
              setPublished(true);
            }}
          >
            Publicar
          </button>
          <ShiftPublishedNextSteps
            open={published}
            onClose={() => setPublished(false)}
            onViewShift={() => setPublished(false)}
          />
        </>
      );
    }
    render(
      <PushPromptProvider>
        <Publicar />
      </PushPromptProvider>
    );
    await user.click(screen.getByRole("button", { name: "Publicar" }));
    expect(screen.getByText("¡Turno publicado!")).toBeInTheDocument();
    expect(screen.getByText("Activá las notificaciones")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByText("¡Turno publicado!")).not.toBeInTheDocument());
    expect(screen.getByText("Activá las notificaciones")).toBeInTheDocument();
    expect(localStorage.getItem("staffya_push_prompt_shown")).toBeNull();

    // (La aserción de localStorage es la que prueba que el pedido no se descartó:
    // el DOM no sirve, la animación de salida deja la hoja visible un rato.)
    // Un segundo Escape sí lo descarta (ahí queda registrado, ya lo vio).
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByText("Activá las notificaciones")).not.toBeInTheDocument());
    expect(localStorage.getItem("staffya_push_prompt_shown")).toBe("1");
  });
});
