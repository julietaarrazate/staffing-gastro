import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTwoFactorGateHandler } from "@/lib/api";
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

/** Navegador con soporte de push. `subscribed: false` = nunca las activó;
 * `shown` = avisos que ya están a la vista en la bandeja del sistema. */
function stubBrowser({
  permission = "granted",
  subscribed = true,
  registered = true,
  shown = 0,
}: {
  permission?: NotificationPermission;
  subscribed?: boolean;
  registered?: boolean;
  shown?: number;
} = {}) {
  const subscription = {
    endpoint: ENDPOINT,
    toJSON: () => SUBSCRIPTION_JSON,
    unsubscribe: vi.fn().mockResolvedValue(true),
  };
  const notifications = Array.from({ length: shown }, () => ({ close: vi.fn() }));
  const registration = {
    pushManager: { getSubscription: async () => (subscribed ? subscription : null) },
    getNotifications: vi.fn().mockResolvedValue(notifications),
  };
  const serviceWorker = {
    register: vi.fn(),
    getRegistration: vi.fn().mockResolvedValue(registered ? registration : undefined),
  };
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: serviceWorker });
  vi.stubGlobal("PushManager", class {});
  vi.stubGlobal("Notification", { permission });
  return { subscription, serviceWorker, registration, notifications };
}

/** El 403 con código que el backend le manda a una sesión admin sin la
 * verificación en dos pasos (ADR-0023), en cualquier endpoint. */
function candado(code: string) {
  return jsonResponse(403, { detail: { code, message: "Falta la verificación en dos pasos." } });
}

const CODIGOS_DEL_CANDADO = ["two_factor_setup_required", "two_factor_required"];

/** Deja correr lo que quedó sin esperar (los avisos se cierran en paralelo). */
function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
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
    setTwoFactorGateHandler(null);
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

    // Nadie lo pidió desde una pantalla: si el backend lo rechaza porque a la
    // admin le falta la verificación en dos pasos, no puede llevarla al alta
    // ni cerrarle la sesión antes de que una pantalla pida algo.
    it.each(CODIGOS_DEL_CANDADO)(
      "si lo frena el candado de dos pasos (%s) no avisa al manejador",
      async (code) => {
        stubBrowser();
        const gate = vi.fn();
        setTwoFactorGateHandler(gate);
        fetchMock.mockResolvedValue(candado(code));

        await expect(claimPushForAccount("token-de-la-admin")).resolves.toBe(false);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(gate).not.toHaveBeenCalled();
      }
    );
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

    // La respuesta de la baja llega cuando la sesión ya se cerró: si avisara
    // al candado, mandaría al alta (o al login) a alguien que ya salió.
    it.each(CODIGOS_DEL_CANDADO)(
      "si la frena el candado de dos pasos (%s) no avisa al manejador",
      async (code) => {
        stubBrowser();
        const gate = vi.fn();
        setTwoFactorGateHandler(gate);
        fetchMock.mockResolvedValue(candado(code));

        await expect(releasePushFromAccount("token-de-la-admin")).resolves.toBe(false);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(gate).not.toHaveBeenCalled();
      }
    );

    it("saca de la bandeja los avisos que este dispositivo ya había mostrado", async () => {
      const { notifications } = stubBrowser({ shown: 2 });
      fetchMock.mockResolvedValue(jsonResponse(204));

      await expect(releasePushFromAccount("token-de-ana")).resolves.toBe(true);
      await flush();

      // En un dispositivo compartido, quien lo usa después no tiene que
      // seguir leyendo el título y el texto de los avisos de la cuenta que salió.
      for (const notification of notifications) expect(notification.close).toHaveBeenCalledTimes(1);
    });

    it("los saca aunque el navegador ya no tenga suscripción", async () => {
      const { notifications } = stubBrowser({ subscribed: false, shown: 1 });

      await expect(releasePushFromAccount("token-de-ana")).resolves.toBe(false);
      await flush();

      expect(notifications[0].close).toHaveBeenCalledTimes(1);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("si el navegador no deja leer los avisos mostrados, la baja sale igual", async () => {
      const { registration } = stubBrowser();
      registration.getNotifications.mockRejectedValue(new Error("NotAllowedError"));
      fetchMock.mockResolvedValue(jsonResponse(204));

      await expect(releasePushFromAccount("token-de-ana")).resolves.toBe(true);
      await flush();

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
