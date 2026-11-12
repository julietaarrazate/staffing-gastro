import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { claimPushForAccount, releasePushFromAccount } from "@/lib/push";

// Las notificaciones de un dispositivo son de la cuenta que tiene la sesión
// abierta ahí (ver docs/reference/ACCESO_MODERNO.md): al abrir la sesión se
// registra la suscripción que el navegador ya tiene, y al cerrarla se da de
// baja en el servidor sin cancelar la del navegador.

const ENDPOINT = "https://fcm.googleapis.com/fcm/send/este-navegador";
const SUBSCRIPTION_JSON = { endpoint: ENDPOINT, keys: { p256dh: "p", auth: "a" } };

function jsonResponse(status: number, body: unknown = {}) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Navegador con soporte de push. `subscription: null` = nunca las activó. */
function stubBrowser({
  permission = "granted",
  subscribed = true,
  registered = true,
}: { permission?: NotificationPermission; subscribed?: boolean; registered?: boolean } = {}) {
  const subscription = {
    endpoint: ENDPOINT,
    toJSON: () => SUBSCRIPTION_JSON,
    unsubscribe: vi.fn().mockResolvedValue(true),
  };
  const serviceWorker = {
    register: vi.fn(),
    getRegistration: vi.fn().mockResolvedValue(
      registered
        ? { pushManager: { getSubscription: async () => (subscribed ? subscription : null) } }
        : undefined
    ),
  };
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: serviceWorker });
  vi.stubGlobal("PushManager", class {});
  vi.stubGlobal("Notification", { permission });
  return { subscription, serviceWorker };
}

function requestOf(call: unknown[]) {
  const [url, init] = call as [string, RequestInit];
  return {
    url,
    method: init.method,
    authorization: (init.headers as Record<string, string>).Authorization,
    body: init.body ? JSON.parse(init.body as string) : undefined,
  };
}

describe("push de la cuenta que tiene la sesión abierta", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (navigator as unknown as Record<string, unknown>).serviceWorker;
  });

  describe("claimPushForAccount (al abrir la sesión)", () => {
    it("registra a nombre de la cuenta la suscripción que el navegador ya tiene", async () => {
      const { serviceWorker } = stubBrowser();
      fetchMock.mockResolvedValue(jsonResponse(201, { ok: true }));

      await expect(claimPushForAccount("token-de-ana")).resolves.toBe(true);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const sent = requestOf(fetchMock.mock.calls[0]);
      expect(sent.url).toMatch(/\/push\/subscribe$/);
      expect(sent.method).toBe("POST");
      expect(sent.authorization).toBe("Bearer token-de-ana");
      expect(sent.body).toEqual(SUBSCRIPTION_JSON);
      // No instala el service worker ni pide permiso: sólo mira lo que ya hay.
      expect(serviceWorker.register).not.toHaveBeenCalled();
    });

    it.each([
      ["nunca activó las notificaciones", { subscribed: false }],
      ["el service worker no está registrado", { registered: false }],
      ["todavía no decidió el permiso", { permission: "default" as const }],
      ["bloqueó el permiso", { permission: "denied" as const }],
    ])("no manda nada si %s", async (_caso, browser) => {
      stubBrowser(browser);

      await expect(claimPushForAccount("token-de-ana")).resolves.toBe(false);

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("no manda nada en un navegador sin soporte de push", async () => {
      await expect(claimPushForAccount("token-de-ana")).resolves.toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("si el servidor falla no rompe el ingreso", async () => {
      stubBrowser();
      fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

      await expect(claimPushForAccount("token-de-ana")).resolves.toBe(false);
    });
  });

  describe("releasePushFromAccount (al cerrar sesión)", () => {
    it("da de baja este dispositivo en el servidor con el endpoint y el token", async () => {
      const { subscription } = stubBrowser();
      fetchMock.mockResolvedValue(jsonResponse(204));

      await expect(releasePushFromAccount("token-de-ana")).resolves.toBe(true);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const sent = requestOf(fetchMock.mock.calls[0]);
      expect(sent.url).toMatch(/\/push\/subscribe$/);
      expect(sent.method).toBe("DELETE");
      expect(sent.authorization).toBe("Bearer token-de-ana");
      expect(sent.body).toEqual({ endpoint: ENDPOINT });
      // La suscripción del navegador queda: quien vuelve a entrar en su
      // celular recupera los avisos sin tener que activarlos de nuevo.
      expect(subscription.unsubscribe).not.toHaveBeenCalled();
    });

    it("no manda nada si el navegador no tiene suscripción", async () => {
      stubBrowser({ subscribed: false });

      await expect(releasePushFromAccount("token-de-ana")).resolves.toBe(false);

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("si el servidor falla no rompe el cierre de sesión", async () => {
      stubBrowser();
      fetchMock.mockResolvedValue(jsonResponse(401, { detail: "No autorizado" }));

      await expect(releasePushFromAccount("token-vencido")).resolves.toBe(false);
    });

    it("si el navegador falla al leer la suscripción tampoco rompe", async () => {
      const { serviceWorker } = stubBrowser();
      serviceWorker.getRegistration.mockRejectedValue(new Error("SecurityError"));

      await expect(releasePushFromAccount("token-de-ana")).resolves.toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
