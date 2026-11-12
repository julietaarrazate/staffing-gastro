import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { Modal, Sheet } from "@/components/ui";
import { PushPromptProvider, usePushPrompt } from "@/lib/push-prompt-context";
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

function Stacked({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}

describe("useEscapeLayer", () => {
  it("con dos capas apiladas, Escape cierra sólo la de arriba; el segundo cierra la otra", async () => {
    const user = userEvent.setup();
    render(
      <Stacked>
        <Layer label="abajo" />
        <Layer label="arriba" />
      </Stacked>
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
      <Stacked>
        <Layer label="alta" priority={60} />
        <Layer label="baja" priority={50} />
      </Stacked>
    );
    await user.keyboard("{Escape}");
    expect(screen.queryByText("alta")).not.toBeInTheDocument();
    expect(screen.getByText("baja")).toBeInTheDocument();
  });

  it("Modal encima de Sheet: Escape cierra el Modal y el Sheet sigue abierto", async () => {
    const user = userEvent.setup();
    function Both() {
      const [modal, setModal] = useState(true);
      const [sheet, setSheet] = useState(true);
      return (
        <>
          <Sheet open={sheet} onClose={() => setSheet(false)} title="Hoja">
            <p>contenido hoja</p>
          </Sheet>
          <Modal open={modal} onClose={() => setModal(false)} title="Diálogo">
            <p>contenido diálogo</p>
          </Modal>
        </>
      );
    }
    render(<Both />);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByText("contenido diálogo")).not.toBeInTheDocument());
    expect(screen.getByText("contenido hoja")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByText("contenido hoja")).not.toBeInTheDocument());
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

    // Un segundo Escape sí lo descarta (ahí queda registrado, ya lo vio).
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByText("Activá las notificaciones")).not.toBeInTheDocument());
    expect(localStorage.getItem("staffya_push_prompt_shown")).toBe("1");
  });
});
