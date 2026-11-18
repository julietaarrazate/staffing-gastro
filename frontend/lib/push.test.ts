import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTwoFactorGateHandler } from "@/lib/api";
import {
  CLAIM_WAITS_FOR_RELEASE_MS,
  claimPushForAccount,
  PENDING_RELEASES_KEY,
  RELEASE_TIMEOUT_MS,
  releasePushFromAccount,
  retryPendingPushReleases,
} from "@/lib/push";

// Las notificaciones de un dispositivo son de la cuenta que tiene la sesión
// abierta ahí (ver docs/reference/ACCESO_MODERNO.md): al abrir la sesión se
// registra la suscripción que el navegador ya tiene, y al terminarla se da de
// baja en el servidor sin cancelar la del navegador. La baja no lleva el
// token de la sesión (pudo haber vencido): se prueba con la clave de la
// suscripción, y si no llega queda pendiente y se reintenta.

const ENDPOINT = "https://fcm.googleapis.com/fcm/send/este-navegador";
const SUBSCRIPTION_JSON = { endpoint: ENDPOINT, keys: { p256dh: "p", auth: "a" } };
const ANA = "u-ana";
const BETO = "u-beto";
/** Lo que manda la baja de `accountId` desde este navegador. */
const bajaDe = (accountId: string) => ({ endpoint: ENDPOINT, auth: "a", user_id: accountId });

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
    path: url.replace(/^.*\/api\/v1/, ""),
    method: init.method,
    authorization: (init.headers as Record<string, string>).Authorization,
    body: init.body ? JSON.parse(init.body as string) : undefined,
  };
}

function pendientes(): string[] {
  return JSON.parse(localStorage.getItem(PENDING_RELEASES_KEY) ?? "[]");
}

function dejarPendiente(...accountIds: string[]) {
  localStorage.setItem(PENDING_RELEASES_KEY, JSON.stringify(accountIds));
}

describe("push de la cuenta que tiene la sesión abierta", () => {
  const fetchMock = vi.fn();

  /** Lo que salió al servidor, en orden: "/push/release" o "/push/subscribe". */
  function sent() {
    return fetchMock.mock.calls.map((call) => requestOf(call).path);
  }

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    localStorage.clear();
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

      await expect(claimPushForAccount("token-de-ana", ANA)).resolves.toBe(true);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const sentRequest = requestOf(fetchMock.mock.calls[0]);
      expect(sentRequest.url).toMatch(/\/push\/subscribe$/);
      expect(sentRequest.method).toBe("POST");
      expect(sentRequest.authorization).toBe("Bearer token-de-ana");
      expect(sentRequest.body).toEqual(SUBSCRIPTION_JSON);
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

      await expect(claimPushForAccount("token-de-ana", ANA)).resolves.toBe(false);

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("no manda nada en un navegador sin soporte de push", async () => {
      await expect(claimPushForAccount("token-de-ana", ANA)).resolves.toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("si el servidor falla no rompe el ingreso", async () => {
      stubBrowser();
      fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

      await expect(claimPushForAccount("token-de-ana", ANA)).resolves.toBe(false);
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

        await expect(claimPushForAccount("token-de-la-admin", "u-admin")).resolves.toBe(false);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(gate).not.toHaveBeenCalled();
      }
    );

    // Salió sin conexión y volvió a entrar: si la baja pendiente saliera
    // ahora, le borraría el registro que acaba de hacer.
    it("si la cuenta que entra tenía una baja pendiente, se descarta sin mandarla", async () => {
      stubBrowser();
      dejarPendiente(ANA);
      fetchMock.mockResolvedValue(jsonResponse(201, { ok: true }));

      await expect(claimPushForAccount("token-de-ana", ANA)).resolves.toBe(true);
      await flush();

      expect(sent()).toEqual(["/push/subscribe"]);
      expect(pendientes()).toEqual([]);
    });

    it("la descarta aunque este navegador no llegue a registrar nada", async () => {
      stubBrowser({ permission: "default" });
      dejarPendiente(ANA);

      await expect(claimPushForAccount("token-de-ana", ANA)).resolves.toBe(false);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(pendientes()).toEqual([]);
    });

    // Navegador compartido: Beto salió sin conexión y ahora entra Ana. Da
    // igual cuál llegue primero: el servidor sólo borra si la fila sigue
    // siendo de Beto.
    it("la baja pendiente de otra cuenta se reintenta y el registro sale después", async () => {
      stubBrowser();
      dejarPendiente(BETO);
      fetchMock.mockImplementation(async (url: string) =>
        url.endsWith("/push/release") ? jsonResponse(204) : jsonResponse(201, { ok: true })
      );

      await expect(claimPushForAccount("token-de-ana", ANA)).resolves.toBe(true);

      expect(sent()).toEqual(["/push/release", "/push/subscribe"]);
      expect(requestOf(fetchMock.mock.calls[0]).body).toEqual(bajaDe(BETO));
      expect(requestOf(fetchMock.mock.calls[0]).authorization).toBeUndefined();
      expect(pendientes()).toEqual([]);
    });

    it("si esa baja vuelve a fallar, el registro sale igual y sigue pendiente", async () => {
      stubBrowser();
      dejarPendiente(BETO, ANA);
      fetchMock.mockImplementation(async (url: string) => {
        if (url.endsWith("/push/release")) throw new TypeError("Failed to fetch");
        return jsonResponse(201, { ok: true });
      });

      await expect(claimPushForAccount("token-de-ana", ANA)).resolves.toBe(true);

      expect(sent()).toEqual(["/push/release", "/push/subscribe"]);
      // La de Ana se descartó (entró); la de Beto queda para el próximo intento.
      expect(pendientes()).toEqual([BETO]);
    });
  });

  describe("releasePushFromAccount (cuando la sesión termina en este dispositivo)", () => {
    it("da de baja el dispositivo sin token: con el endpoint, la clave y la cuenta que sale", async () => {
      const { subscription } = stubBrowser();
      fetchMock.mockResolvedValue(jsonResponse(204));

      await expect(releasePushFromAccount(ANA)).resolves.toBe(true);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const sentRequest = requestOf(fetchMock.mock.calls[0]);
      expect(sentRequest.url).toMatch(/\/push\/release$/);
      expect(sentRequest.method).toBe("POST");
      // Sirve igual con el token vencido: la prueba es la clave del navegador.
      expect(sentRequest.authorization).toBeUndefined();
      expect(sentRequest.body).toEqual(bajaDe(ANA));
      expect(pendientes()).toEqual([]);
      // La suscripción del navegador queda: quien vuelve a entrar en su
      // celular recupera los avisos sin tener que activarlos de nuevo.
      expect(subscription.unsubscribe).not.toHaveBeenCalled();
    });

    it("no manda nada ni deja pendiente si el navegador no tiene suscripción", async () => {
      stubBrowser({ subscribed: false });

      await expect(releasePushFromAccount(ANA)).resolves.toBe(false);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(pendientes()).toEqual([]);
    });

    it.each([
      ["no hay conexión", () => Promise.reject(new TypeError("Failed to fetch"))],
      ["el servidor está caído (503)", () => Promise.resolve(jsonResponse(503, { detail: "x" }))],
      ["frena por el límite (429)", () => Promise.resolve(jsonResponse(429, { detail: "x" }))],
    ])("si %s, no rompe el cierre y la baja queda pendiente", async (_caso, respuesta) => {
      stubBrowser();
      fetchMock.mockImplementation(respuesta);

      await expect(releasePushFromAccount(ANA)).resolves.toBe(false);

      // Sólo el id de la cuenta: ni el endpoint ni la clave se guardan.
      expect(localStorage.getItem(PENDING_RELEASES_KEY)).toBe(JSON.stringify([ANA]));
    });

    it("si el servidor no contesta a tiempo, se corta y queda pendiente", async () => {
      vi.useFakeTimers();
      try {
        stubBrowser();
        fetchMock.mockImplementation(
          (_url: string, init: RequestInit) =>
            new Promise((_resolve, reject) => {
              init.signal?.addEventListener("abort", () =>
                reject(Object.assign(new Error("aborted"), { name: "AbortError" }))
              );
            })
        );

        const released = releasePushFromAccount(ANA);
        await vi.advanceTimersByTimeAsync(RELEASE_TIMEOUT_MS);

        await expect(released).resolves.toBe(false);
        expect(pendientes()).toEqual([ANA]);
      } finally {
        vi.useRealTimers();
      }
    });

    // Cerrar sesión y cerrar la app enseguida corta el pedido sin que nadie
    // se entere: la baja se anota antes de salir y se borra al confirmarse.
    it("mientras está en camino ya figura como pendiente", async () => {
      stubBrowser();
      let answer!: (response: Response) => void;
      fetchMock.mockReturnValue(new Promise<Response>((resolve) => (answer = resolve)));

      const released = releasePushFromAccount(ANA);
      expect(pendientes()).toEqual([ANA]);
      await flush();
      expect(pendientes()).toEqual([ANA]);

      answer(jsonResponse(204));
      await expect(released).resolves.toBe(true);
      expect(pendientes()).toEqual([]);
    });

    it("un rechazo definitivo del servidor (422) no se reintenta", async () => {
      stubBrowser();
      fetchMock.mockResolvedValue(jsonResponse(422, { detail: "El endpoint no es conocido" }));

      await expect(releasePushFromAccount(ANA)).resolves.toBe(false);

      expect(pendientes()).toEqual([]);
    });

    // El frontend puede publicarse antes que el backend: un 404 o 405 es la
    // ruta que todavía no está, no un rechazo de la baja.
    it.each([404, 405])("un %i (backend sin la ruta todavía) queda pendiente", async (status) => {
      stubBrowser();
      fetchMock.mockResolvedValue(jsonResponse(status, { detail: "Not Found" }));

      await expect(releasePushFromAccount(ANA)).resolves.toBe(false);

      expect(pendientes()).toEqual([ANA]);
    });

    it("si el navegador falla al leer la suscripción tampoco rompe", async () => {
      const { serviceWorker } = stubBrowser();
      serviceWorker.getRegistration.mockRejectedValue(new Error("SecurityError"));

      await expect(releasePushFromAccount(ANA)).resolves.toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("guarda varias cuentas pendientes sin repetir (dispositivo compartido sin conexión)", async () => {
      stubBrowser();
      fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

      await releasePushFromAccount(BETO);
      await releasePushFromAccount(ANA);
      await releasePushFromAccount(BETO);

      expect(pendientes()).toEqual([ANA, BETO]);
    });

    // La baja ya no lleva la sesión, así que el candado no la alcanza; si
    // igual contestara así, no puede mandar al alta a alguien que ya salió.
    it.each(CODIGOS_DEL_CANDADO)(
      "si la frenara el candado de dos pasos (%s) no avisa al manejador",
      async (code) => {
        stubBrowser();
        const gate = vi.fn();
        setTwoFactorGateHandler(gate);
        fetchMock.mockResolvedValue(candado(code));

        await expect(releasePushFromAccount("u-admin")).resolves.toBe(false);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(gate).not.toHaveBeenCalled();
      }
    );

    it("saca de la bandeja los avisos que este dispositivo ya había mostrado", async () => {
      const { notifications } = stubBrowser({ shown: 2 });
      fetchMock.mockResolvedValue(jsonResponse(204));

      await expect(releasePushFromAccount(ANA)).resolves.toBe(true);
      await flush();

      // En un dispositivo compartido, quien lo usa después no tiene que
      // seguir leyendo el título y el texto de los avisos de la cuenta que salió.
      for (const notification of notifications) expect(notification.close).toHaveBeenCalledTimes(1);
    });

    it("los saca aunque el navegador ya no tenga suscripción", async () => {
      const { notifications } = stubBrowser({ subscribed: false, shown: 1 });

      await expect(releasePushFromAccount(ANA)).resolves.toBe(false);
      await flush();

      expect(notifications[0].close).toHaveBeenCalledTimes(1);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("si el navegador no deja leer los avisos mostrados, la baja sale igual", async () => {
      const { registration } = stubBrowser();
      registration.getNotifications.mockRejectedValue(new Error("NotAllowedError"));
      fetchMock.mockResolvedValue(jsonResponse(204));

      await expect(releasePushFromAccount(ANA)).resolves.toBe(true);
      await flush();

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("retryPendingPushReleases (al abrir la app, al volver la conexión o la pestaña)", () => {
    it("sin bajas pendientes no manda nada", async () => {
      stubBrowser();

      await expect(retryPendingPushReleases()).resolves.toBe(true);

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("manda la pendiente con el endpoint y la clave que tiene el navegador ahora", async () => {
      stubBrowser();
      dejarPendiente(ANA);
      fetchMock.mockResolvedValue(jsonResponse(204));

      await expect(retryPendingPushReleases()).resolves.toBe(true);

      expect(sent()).toEqual(["/push/release"]);
      expect(requestOf(fetchMock.mock.calls[0]).body).toEqual(bajaDe(ANA));
      expect(requestOf(fetchMock.mock.calls[0]).authorization).toBeUndefined();
      expect(pendientes()).toEqual([]);
    });

    it("si vuelve a fallar sigue pendiente, y el intento siguiente la saca", async () => {
      stubBrowser();
      dejarPendiente(ANA);
      fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
      fetchMock.mockResolvedValue(jsonResponse(204));

      await expect(retryPendingPushReleases()).resolves.toBe(false);
      expect(pendientes()).toEqual([ANA]);

      await expect(retryPendingPushReleases()).resolves.toBe(true);
      expect(pendientes()).toEqual([]);
      expect(sent()).toEqual(["/push/release", "/push/release"]);
    });

    it("si el navegador ya no tiene suscripción, la descarta sin mandar nada", async () => {
      stubBrowser({ subscribed: false });
      dejarPendiente(ANA, BETO);

      await retryPendingPushReleases();

      expect(fetchMock).not.toHaveBeenCalled();
      expect(pendientes()).toEqual([]);
    });

    it("manda una baja por cada cuenta pendiente", async () => {
      stubBrowser();
      dejarPendiente(BETO, ANA);
      fetchMock.mockResolvedValue(jsonResponse(204));

      await expect(retryPendingPushReleases()).resolves.toBe(true);

      expect(fetchMock.mock.calls.map((call) => requestOf(call).body.user_id).sort()).toEqual(
        [ANA, BETO].sort()
      );
      expect(pendientes()).toEqual([]);
    });

    // Ese dispositivo es de quien tiene la sesión abierta: mandarla le
    // borraría el registro. La descarta su propio registro (`claim`).
    it("no manda la de la cuenta que tiene la sesión abierta en este navegador", async () => {
      stubBrowser();
      dejarPendiente(ANA, BETO);
      fetchMock.mockResolvedValue(jsonResponse(204));

      await retryPendingPushReleases(ANA);

      expect(fetchMock.mock.calls.map((call) => requestOf(call).body.user_id)).toEqual([BETO]);
      expect(pendientes()).toEqual([ANA]);
    });

    it("no repite una baja que esta pestaña todavía tiene en camino", async () => {
      stubBrowser();
      let answer!: (response: Response) => void;
      fetchMock.mockReturnValue(new Promise<Response>((resolve) => (answer = resolve)));

      const released = releasePushFromAccount(ANA);
      await flush();
      // Vuelve la conexión con la baja todavía sin contestar.
      await retryPendingPushReleases();
      expect(sent()).toEqual(["/push/release"]);

      answer(jsonResponse(204));
      await expect(released).resolves.toBe(true);
    });

    it("una pendiente ilegible no rompe nada", async () => {
      stubBrowser();
      localStorage.setItem(PENDING_RELEASES_KEY, "{esto no es una lista");

      await expect(retryPendingPushReleases()).resolves.toBe(true);
      localStorage.setItem(PENDING_RELEASES_KEY, JSON.stringify({ id: ANA }));
      await expect(retryPendingPushReleases()).resolves.toBe(true);

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  // El cierre de sesión no espera la baja, así que puede seguir en camino
  // cuando alguien vuelve a entrar. Si el registro nuevo le gana al servidor,
  // la baja de la misma cuenta borra la fila recién creada: Ajustes dice
  // "Activadas" y no llega ningún aviso. Por eso el registro sale después.
  describe("la baja que sigue en camino cuando alguien vuelve a entrar", () => {
    /** Las bajas que la prueba dejó sin contestar: se sueltan al terminar,
     * para que ninguna quede en camino para la prueba siguiente. */
    let heldBack: Array<(response: Response) => void>;

    /** El servidor contesta el registro enseguida y cada baja cuando diga
     * `answer` (`null` = no contesta hasta que la prueba la suelte). */
    function backend(answer: (nth: number) => Promise<Response> | null) {
      let bajas = 0;
      fetchMock.mockImplementation((url: string) => {
        if (!url.endsWith("/push/release")) return Promise.resolve(jsonResponse(201, { ok: true }));
        return (
          answer(++bajas) ?? new Promise<Response>((resolve) => heldBack.push(resolve))
        );
      });
    }

    beforeEach(() => {
      heldBack = [];
    });

    afterEach(async () => {
      vi.useRealTimers();
      for (const answerNow of heldBack) answerNow(jsonResponse(204));
      await flush();
    });

    it("el registro espera a que la baja termine y sale después", async () => {
      stubBrowser();
      backend(() => null);

      const released = releasePushFromAccount(ANA);
      const claimed = claimPushForAccount("token-nuevo-de-ana", ANA);
      await flush();
      expect(sent()).toEqual(["/push/release"]);

      heldBack[0](jsonResponse(204));
      await expect(released).resolves.toBe(true);
      await expect(claimed).resolves.toBe(true);

      expect(sent()).toEqual(["/push/release", "/push/subscribe"]);
      expect(requestOf(fetchMock.mock.calls[1]).authorization).toBe("Bearer token-nuevo-de-ana");
      expect(pendientes()).toEqual([]);
    });

    it("si esa baja falla, el registro sale igual", async () => {
      stubBrowser();
      backend(() => Promise.reject(new TypeError("Failed to fetch")));

      const released = releasePushFromAccount(ANA);
      const claimed = claimPushForAccount("token-de-otra-cuenta", BETO);

      await expect(released).resolves.toBe(false);
      await expect(claimed).resolves.toBe(true);
      expect(sent()).toEqual(["/push/release", "/push/subscribe"]);
      expect(pendientes()).toEqual([ANA]);
    });

    // Volvió a entrar la misma cuenta con su baja todavía en camino: si esa
    // baja falla después, no puede quedar pendiente (un reintento le
    // borraría el registro nuevo).
    it("si la baja de la misma cuenta falla después de que volvió a entrar, no queda pendiente", async () => {
      stubBrowser();
      backend(() => null);

      const released = releasePushFromAccount(ANA);
      const claimed = claimPushForAccount("token-nuevo-de-ana", ANA);
      await flush();
      heldBack[0](jsonResponse(503, { detail: "x" }));

      await expect(released).resolves.toBe(false);
      await expect(claimed).resolves.toBe(true);
      expect(sent()).toEqual(["/push/release", "/push/subscribe"]);
      expect(pendientes()).toEqual([]);
    });

    it("si la baja no contesta, el registro la espera un rato y después sale", async () => {
      vi.useFakeTimers();
      stubBrowser();
      backend(() => null);

      void releasePushFromAccount(ANA);
      const claimed = claimPushForAccount("token-de-otra-cuenta", BETO);
      await vi.advanceTimersByTimeAsync(CLAIM_WAITS_FOR_RELEASE_MS - 1);
      expect(sent()).toEqual(["/push/release"]);

      // Con tope: una baja colgada no puede dejar el dispositivo a nombre de
      // la cuenta que salió mientras otra ya está adentro.
      await vi.advanceTimersByTimeAsync(1);
      await expect(claimed).resolves.toBe(true);
      expect(sent()).toEqual(["/push/release", "/push/subscribe"]);
    });

    it("el registro también espera a un reintento que está en camino", async () => {
      stubBrowser();
      dejarPendiente(BETO);
      backend(() => null);

      const retried = retryPendingPushReleases();
      const claimed = claimPushForAccount("token-de-ana", ANA);
      await flush();
      expect(sent()).toEqual(["/push/release"]);

      heldBack[0](jsonResponse(204));
      await expect(retried).resolves.toBe(true);
      await expect(claimed).resolves.toBe(true);
      expect(sent()).toEqual(["/push/release", "/push/subscribe"]);
    });

    // Un reintento no es el fin de esta sesión: no puede cancelar su registro.
    it("un reintento de otra cuenta mientras el registro espera no lo cancela", async () => {
      stubBrowser();
      backend(() => null);

      void releasePushFromAccount(BETO);
      const claimed = claimPushForAccount("token-de-ana", ANA);
      await flush();
      dejarPendiente(BETO, "u-carla");
      void retryPendingPushReleases(ANA);
      await flush();
      heldBack[0](jsonResponse(204));

      await expect(claimed).resolves.toBe(true);
      expect(sent()).toEqual(["/push/release", "/push/release", "/push/subscribe"]);
    });

    it("si la sesión se vuelve a cerrar mientras el registro esperaba, ese registro no sale", async () => {
      stubBrowser();
      backend((nth) => (nth === 1 ? null : Promise.resolve(jsonResponse(204))));

      void releasePushFromAccount(ANA);
      const claimed = claimPushForAccount("token-nuevo-de-ana", ANA);
      await flush();
      // Entró y salió enseguida: la segunda baja sale ya, sin esperar a nadie.
      await expect(releasePushFromAccount(ANA)).resolves.toBe(true);
      heldBack[0](jsonResponse(204));

      // Si saliera ahora, llegaría después de la baja de esa misma sesión y el
      // dispositivo quedaría a nombre de una cuenta que ya no está.
      await expect(claimed).resolves.toBe(false);
      expect(sent()).toEqual(["/push/release", "/push/release"]);
    });

    it("si la sesión se cierra antes de que el registro llegue a salir, no sale", async () => {
      stubBrowser();
      backend(() => Promise.resolve(jsonResponse(204)));

      const claimed = claimPushForAccount("token-de-ana", ANA);
      const released = releasePushFromAccount(ANA);

      await expect(claimed).resolves.toBe(false);
      await expect(released).resolves.toBe(true);
      expect(sent()).toEqual(["/push/release"]);
    });
  });
});
