import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PushToggle from "./PushToggle";

// Interruptor de notificaciones de Ajustes. Las notificaciones de un
// dispositivo son de la cuenta que tiene la sesión abierta ahí
// (docs/reference/ACCESO_MODERNO.md): mientras una admin está en «Ver como»,
// el dispositivo sigue siendo de ella y el interruptor no puede dejarlo a
// nombre de la persona que está viendo, ni darlo de baja.

let session: {
  token: string | null;
  impersonating: { adminUser: unknown } | null;
};
vi.mock("@/lib/auth-context", () => ({ useAuth: () => session }));

const toast = vi.fn();
vi.mock("@/components/ui", async (original) => ({
  ...(await original<typeof import("@/components/ui")>()),
  useToast: () => toast,
}));

let soportado = true;
const subscribe = vi.fn();
const unsubscribe = vi.fn();
let browserSubscription: { endpoint: string } | null;
vi.mock("@/lib/push", () => ({
  isPushSupported: () => soportado,
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
  soportado = true;
  toast.mockReset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  subscribe.mockReset().mockResolvedValue(true);
  unsubscribe.mockReset().mockResolvedValue(undefined);
  browserSubscription = {
    endpoint: "https://fcm.googleapis.com/fcm/send/este-navegador",
  };
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
    [
      "Activadas",
      { endpoint: "https://fcm.googleapis.com/fcm/send/este-navegador" },
    ],
    ["Desactivadas", null],
  ] as const)(
    "en «Ver como» queda deshabilitado, lo explica y no cambia nada (%s)",
    async (estado, subscription) => {
      browserSubscription = subscription;
      session = {
        token: "token-impersonado",
        impersonating: { adminUser: { id: "u-admin" } },
      };

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
    },
  );
});

describe("PushToggle: cuando activar no puede funcionar", () => {
  it("con el permiso bloqueado no es un botón y explica cómo activarlo", () => {
    vi.stubGlobal("Notification", { permission: "denied" });
    render(<PushToggle />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Bloqueadas")).toBeVisible();
    expect(
      screen.getByText(/Bloqueaste las notificaciones de Oído/),
    ).toBeVisible();
    expect(screen.getByText(/candado/)).toBeVisible();
  });

  it("iPhone sin instalar la app: «Instalá la app para recibir avisos» y cómo", () => {
    soportado = false;
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",
    );
    render(<PushToggle />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(
      screen.getByText("Instalá la app para recibir avisos."),
    ).toBeVisible();
    expect(screen.getByText(/Compartir.*Agregar a inicio/)).toBeVisible();
  });

  it("navegador sin soporte y sin nada que hacer: no muestra la fila", () => {
    soportado = false;
    const { container } = render(<PushToggle />);
    expect(container).toBeEmptyDOMElement();
  });

  it("si la suscripción falla avisa con el aviso flotante y sigue apagado", async () => {
    browserSubscription = null;
    subscribe.mockResolvedValue(false);
    const toggle = await renderToggle("Desactivadas");

    fireEvent.click(toggle);
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.stringMatching(/No pudimos activar/),
        "error",
      ),
    );
    expect(toggle).toHaveTextContent("Desactivadas");
  });

  it("si el pedido tira error también avisa", async () => {
    browserSubscription = null;
    subscribe.mockRejectedValue(new Error("red"));
    const toggle = await renderToggle("Desactivadas");

    fireEvent.click(toggle);
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.stringMatching(/No pudimos activar/),
        "error",
      ),
    );
    expect(toggle).toHaveTextContent("Desactivadas");
  });

  it("si la persona rechaza el permiso, la fila pasa a explicar cómo activarlo (sin aviso de falla)", async () => {
    const notification = { permission: "default" };
    vi.stubGlobal("Notification", notification);
    browserSubscription = null;
    subscribe.mockImplementation(async () => {
      notification.permission = "denied";
      return false;
    });
    const toggle = await renderToggle("Desactivadas");

    fireEvent.click(toggle);
    await waitFor(() => expect(screen.getByText("Bloqueadas")).toBeVisible());
    expect(toast).not.toHaveBeenCalled();
  });
});
