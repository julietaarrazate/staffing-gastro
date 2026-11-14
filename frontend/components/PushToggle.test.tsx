import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PushToggle from "./PushToggle";

// Interruptor de notificaciones de Ajustes. Las notificaciones de un
// dispositivo son de la cuenta que tiene la sesión abierta ahí
// (docs/reference/ACCESO_MODERNO.md): mientras una admin está en «Ver como»,
// el dispositivo sigue siendo de ella y el interruptor no puede dejarlo a
// nombre de la persona que está viendo, ni darlo de baja.

let session: { token: string | null; impersonating: { adminUser: unknown } | null };
vi.mock("@/lib/auth-context", () => ({ useAuth: () => session }));

const subscribe = vi.fn();
const unsubscribe = vi.fn();
let browserSubscription: { endpoint: string } | null;
vi.mock("@/lib/push", () => ({
  isPushSupported: () => true,
  getCurrentPushSubscription: async () => browserSubscription,
  subscribeToPush: (...args: unknown[]) => subscribe(...args),
  unsubscribeFromPush: (...args: unknown[]) => unsubscribe(...args),
}));

const EXPLICACION = /Mientras ves la app como otra persona/;

async function renderToggle(estado: "Activadas" | "Desactivadas") {
  render(<PushToggle />);
  const toggle = screen.getByRole("button", { name: /Notificaciones push/ });
  await waitFor(() => expect(toggle).toHaveTextContent(estado));
  return toggle;
}

beforeEach(() => {
  subscribe.mockReset().mockResolvedValue(true);
  unsubscribe.mockReset().mockResolvedValue(undefined);
  browserSubscription = { endpoint: "https://fcm.googleapis.com/fcm/send/este-navegador" };
  session = { token: "token-de-la-cuenta", impersonating: null };
});

describe("PushToggle", () => {
  it("con la cuenta propia apaga y prende las notificaciones del dispositivo", async () => {
    const toggle = await renderToggle("Activadas");
    expect(toggle).toBeEnabled();
    expect(screen.queryByText(EXPLICACION)).not.toBeInTheDocument();

    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveTextContent("Desactivadas"));
    expect(unsubscribe).toHaveBeenCalledWith("token-de-la-cuenta");

    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveTextContent("Activadas"));
    expect(subscribe).toHaveBeenCalledWith("token-de-la-cuenta");
  });

  it.each([
    ["Activadas", { endpoint: "https://fcm.googleapis.com/fcm/send/este-navegador" }],
    ["Desactivadas", null],
  ] as const)(
    "en «Ver como» queda deshabilitado, lo explica y no cambia nada (%s)",
    async (estado, subscription) => {
      browserSubscription = subscription;
      session = { token: "token-impersonado", impersonating: { adminUser: { id: "u-admin" } } };

      const toggle = await renderToggle(estado);

      expect(toggle).toBeDisabled();
      // La explicación está a la vista y también es lo que oye un lector de pantalla.
      expect(screen.getByText(EXPLICACION)).toBeVisible();
      expect(toggle).toHaveAccessibleDescription(EXPLICACION);

      fireEvent.click(toggle);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(subscribe).not.toHaveBeenCalled();
      expect(unsubscribe).not.toHaveBeenCalled();
      expect(toggle).toHaveTextContent(estado);
    }
  );
});
