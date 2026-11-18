import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PushPromptProvider, usePushPrompt } from "@/lib/push-prompt-context";

// Pedido de activar las notificaciones después de una acción (primera
// postulación, primer turno publicado). Mientras una admin está en «Ver
// como» hace esas acciones con la cuenta de otra persona, pero el dispositivo
// es de ella: el pedido no se muestra y no registra nada
// (docs/reference/ACCESO_MODERNO.md).

let session: { token: string | null; impersonating: { adminUser: unknown } | null };
vi.mock("@/lib/auth-context", () => ({ useAuth: () => session }));

const subscribe = vi.fn();
vi.mock("@/lib/push", () => ({
  isPushSupported: () => true,
  subscribeToPush: (...args: unknown[]) => subscribe(...args),
}));

const PROMPT_SHOWN_KEY = "staffya_push_prompt_shown";
const PEDIDO = { name: "Activá las notificaciones" };

function AccionDeNegocio() {
  const { requestOptIn } = usePushPrompt();
  return (
    <button type="button" onClick={requestOptIn}>
      Postularme
    </button>
  );
}

function renderApp() {
  return render(
    <PushPromptProvider>
      <AccionDeNegocio />
    </PushPromptProvider>
  );
}

beforeEach(() => {
  subscribe.mockReset().mockResolvedValue(true);
  localStorage.clear();
  vi.stubGlobal("Notification", { permission: "default" });
  session = { token: "token-de-la-cuenta", impersonating: null };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PushPromptProvider", () => {
  it("con la cuenta propia ofrece activarlas y registra el dispositivo a su nombre", async () => {
    renderApp();

    fireEvent.click(screen.getByRole("button", { name: "Postularme" }));
    expect(await screen.findByRole("heading", PEDIDO)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Activar" }));

    await waitFor(() => expect(subscribe).toHaveBeenCalledWith("token-de-la-cuenta"));
    await waitFor(() => expect(localStorage.getItem(PROMPT_SHOWN_KEY)).toBe("1"));
  });

  it("en «Ver como» no ofrece nada y no gasta el pedido del dispositivo de la admin", async () => {
    session = { token: "token-impersonado", impersonating: { adminUser: { id: "u-admin" } } };
    renderApp();

    fireEvent.click(screen.getByRole("button", { name: "Postularme" }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.queryByRole("heading", PEDIDO)).not.toBeInTheDocument();
    expect(subscribe).not.toHaveBeenCalled();
    // Cuando vuelva a su cuenta se le tiene que poder ofrecer.
    expect(localStorage.getItem(PROMPT_SHOWN_KEY)).toBeNull();
  });

  it("si el pedido ya estaba abierto al empezar «Ver como», «Activar» no registra nada", async () => {
    const { rerender } = renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Postularme" }));
    expect(await screen.findByRole("heading", PEDIDO)).toBeVisible();

    session = { token: "token-impersonado", impersonating: { adminUser: { id: "u-admin" } } };
    rerender(
      <PushPromptProvider>
        <AccionDeNegocio />
      </PushPromptProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Activar" }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(subscribe).not.toHaveBeenCalled();
    expect(localStorage.getItem(PROMPT_SHOWN_KEY)).toBeNull();
    await waitFor(() => expect(screen.queryByRole("heading", PEDIDO)).not.toBeInTheDocument());
  });
});
