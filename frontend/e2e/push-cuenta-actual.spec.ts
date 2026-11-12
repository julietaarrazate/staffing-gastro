import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, GUIDED_TOUR_KEYS, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * Las notificaciones de un dispositivo son de la cuenta que tiene la sesión
 * abierta ahí (docs/reference/ACCESO_MODERNO.md). En un navegador compartido
 * la suscripción quedaba a nombre de quien la activó primero: después de
 * cerrar sesión el dispositivo seguía recibiendo sus avisos, y la cuenta
 * siguiente veía el interruptor "Activadas" sin recibir nada.
 *
 * El navegador de la prueba ya había activado las notificaciones: tiene el
 * service worker registrado, el permiso concedido y una suscripción. Headless
 * no tiene servicio push, así que la suscripción y el permiso se simulan; el
 * registro del service worker, el ingreso y el cierre de sesión son los reales.
 */

const ENDPOINT = "https://fcm.googleapis.com/fcm/send/navegador-e2e";
const SUBSCRIPTION = { endpoint: ENDPOINT, keys: { p256dh: "clave-p256dh", auth: "clave-auth" } };

const CUENTAS = {
  "primera@example.com": { token: "token-de-la-primera", id: "user-primera", role: "worker" },
  "segunda@example.com": { token: "token-de-la-segunda", id: "user-segunda", role: "worker" },
  "admin@example.com": { token: "token-de-la-admin", id: "user-admin", role: "admin" },
} as const;
type Email = keyof typeof CUENTAS;

/** La cuenta que la admin mira con «Ver como». */
const VISTA = {
  id: "user-vista",
  email: "vista@example.com",
  full_name: "Persona vista",
  role: "worker",
  status: "activo",
  is_active: true,
  is_verified: true,
};
const TOKEN_IMPERSONADO = "token-impersonado";

/** El 403 con código que recibe una admin sin la verificación en dos pasos. */
const CANDADO_ALTA = {
  detail: {
    code: "two_factor_setup_required",
    message: "Activá la verificación en dos pasos para usar el panel de admin.",
  },
};

interface PushCall {
  method: string;
  authorization: string | undefined;
  body: unknown;
}

function json(body: unknown, status = 200) {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

function usuario(email: Email) {
  return {
    id: CUENTAS[email].id,
    email,
    full_name: "Cuenta de prueba",
    role: CUENTAS[email].role,
    status: "activo",
    is_active: true,
    is_verified: true,
  };
}

/** `candado`: el backend de una admin que todavía no activó la verificación
 * en dos pasos, que le contesta ese 403 a todo lo que pida con su sesión
 * menos el ingreso y el alta. */
async function mockBackend(page: Page, { candado = false } = {}): Promise<PushCall[]> {
  const pushCalls: PushCall[] = [];

  // Lo que no importa para esta prueba (las pantallas a las que cae el
  // ingreso) contesta 404 en vez de salir a la red. El candado es sólo para
  // pedidos con sesión: lo público (la landing) nunca lo recibe.
  await page.route("**/api/v1/**", async (route) => {
    const conSesion = (await route.request().headerValue("authorization")) != null;
    return route.fulfill(
      candado && conSesion ? json(CANDADO_ALTA, 403) : json({ detail: "sin mock" }, 404)
    );
  });
  if (!candado) await mockEmptyNotifications(page);

  await page.route("**/api/v1/auth/login", (route) => {
    const { email } = route.request().postDataJSON() as { email: Email };
    return route.fulfill(json({ access_token: CUENTAS[email].token, token_type: "bearer" }));
  });
  await page.route("**/api/v1/auth/me", async (route) => {
    const authorization = await route.request().headerValue("authorization");
    const email = (Object.keys(CUENTAS) as Email[]).find(
      (e) => authorization === `Bearer ${CUENTAS[e].token}`
    );
    return email
      ? route.fulfill(json(usuario(email)))
      : route.fulfill(json({ detail: "No autorizado" }, 401));
  });
  await page.route("**/api/v1/auth/logout", (route) => route.fulfill({ status: 204 }));

  await page.route("**/api/v1/push/subscribe", async (route) => {
    const request = route.request();
    pushCalls.push({
      method: request.method(),
      authorization: (await request.headerValue("authorization")) ?? undefined,
      body: request.postDataJSON(),
    });
    if (candado) {
      // La baja contesta con la demora de un backend de verdad: cuando el
      // cierre de sesión ya llevó a la landing.
      if (request.method() === "DELETE") await new Promise((resolve) => setTimeout(resolve, 400));
      return route.fulfill(json(CANDADO_ALTA, 403));
    }
    return request.method() === "DELETE"
      ? route.fulfill({ status: 204 })
      : route.fulfill(json({ ok: true }, 201));
  });

  return pushCalls;
}

/** El navegador ya había activado las notificaciones antes de la prueba:
 * permiso concedido y una suscripción (simulados, ver arriba). El service
 * worker se registra de verdad con `registrarServiceWorker`. */
async function navegadorConPushActivado(page: Page) {
  await page.addInitScript(
    ({ subscription, tourKeys }) => {
      for (const key of tourKeys) window.localStorage.setItem(key, "1");
      Object.defineProperty(Notification, "permission", { configurable: true, get: () => "granted" });
      let cancelled = false;
      PushManager.prototype.getSubscription = async () =>
        cancelled
          ? null
          : ({
              endpoint: subscription.endpoint,
              toJSON: () => subscription,
              unsubscribe: async () => (cancelled = true),
            } as unknown as PushSubscription);
    },
    { subscription: SUBSCRIPTION, tourKeys: GUIDED_TOUR_KEYS }
  );
}

async function registrarServiceWorker(page: Page) {
  await page.goto("/login");
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
  });
}

async function ingresar(page: Page, email: Email, destino = /\/feed$/) {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Contraseña").fill("una-clave-cualquiera");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(destino);
}

test("el push pasa a la cuenta que entra y se da de baja al cerrar sesión", async ({ page }) => {
  await blockExternalHosts(page);
  await skipSplash(page);
  const pushCalls = await mockBackend(page);
  await navegadorConPushActivado(page);

  // El navegador ya tenía las notificaciones activadas de antes.
  await registrarServiceWorker(page);
  expect(pushCalls).toEqual([]); // sin sesión no se registra nada

  // Entra la primera cuenta: el dispositivo queda a su nombre, sin tocar nada.
  await ingresar(page, "primera@example.com");
  const altaDeLaPrimera = {
    method: "POST",
    authorization: "Bearer token-de-la-primera",
    body: SUBSCRIPTION,
  };
  await expect.poll(() => pushCalls).toEqual([altaDeLaPrimera]);

  // Abrir la app con la sesión guardada lo vuelve a registrar (idempotente).
  await page.goto("/profile/settings");
  await expect(page.getByRole("button", { name: /Notificaciones push.*Activadas/ })).toBeVisible();
  await expect.poll(() => pushCalls).toEqual([altaDeLaPrimera, altaDeLaPrimera]);

  // Cierra sesión: el dispositivo se da de baja en el servidor con su token,
  // y la suscripción del navegador queda.
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect
    .poll(() => pushCalls.at(-1))
    .toEqual({
      method: "DELETE",
      authorization: "Bearer token-de-la-primera",
      body: { endpoint: ENDPOINT },
    });
  expect(pushCalls).toHaveLength(3);

  // Entra otra cuenta en el mismo navegador: el dispositivo pasa a ser suyo.
  await ingresar(page, "segunda@example.com");
  await expect
    .poll(() => pushCalls.at(-1))
    .toEqual({
      method: "POST",
      authorization: "Bearer token-de-la-segunda",
      body: SUBSCRIPTION,
    });
  expect(pushCalls).toHaveLength(4);
});

test("en «Ver como» el dispositivo sigue siendo de la admin y Ajustes no deja cambiarlo", async ({
  page,
}) => {
  await blockExternalHosts(page);
  await skipSplash(page);
  const pushCalls = await mockBackend(page);
  await page.route("**/api/v1/admin/test-accounts", (route) => route.fulfill(json([VISTA])));
  await page.route(`**/api/v1/admin/users/${VISTA.id}/impersonate`, (route) =>
    route.fulfill(json({ access_token: TOKEN_IMPERSONADO, token_type: "bearer", user: VISTA }))
  );
  await page.route("**/api/v1/shifts/feed", (route) => route.fulfill(json([])));
  await page.route("**/api/v1/applications/mine", (route) => route.fulfill(json([])));
  await navegadorConPushActivado(page);
  await registrarServiceWorker(page);

  // La admin entra: el dispositivo queda a su nombre.
  await ingresar(page, "admin@example.com", /\/admin/);
  const altaDeLaAdmin = {
    method: "POST",
    authorization: "Bearer token-de-la-admin",
    body: SUBSCRIPTION,
  };
  await expect.poll(() => pushCalls).toEqual([altaDeLaAdmin]);

  // «Ver como» y, ya como esa persona, hasta Ajustes (sin recargar: la
  // impersonación vive en memoria).
  await page.getByRole("link", { name: "Herramientas" }).first().click();
  await page.getByRole("button", { name: "Ver como trabajador" }).click();
  await expect(page).toHaveURL(/\/feed$/);
  await expect(page.getByRole("status").filter({ hasText: "Viendo como" })).toBeVisible();
  await page.getByRole("link", { name: "Perfil", exact: true }).click();
  await page.getByRole("link", { name: "Ajustes" }).click();
  await expect(page).toHaveURL(/\/profile\/settings$/);

  // El interruptor muestra el estado del navegador de la admin, deshabilitado
  // y con la explicación.
  const interruptor = page.getByRole("button", { name: /Notificaciones push.*Activadas/ });
  await expect(interruptor).toBeDisabled();
  await expect(interruptor).toHaveAccessibleDescription(
    "Mientras ves la app como otra persona no se pueden cambiar las notificaciones de este dispositivo."
  );
  await expect(
    page.getByText("Mientras ves la app como otra persona no se pueden cambiar")
  ).toBeVisible();
  await interruptor.click({ force: true });

  // Volver a la cuenta admin tampoco manda nada: en todo el recorrido, ni un
  // pedido con el token de la persona vista y ninguna baja.
  await page.getByRole("button", { name: "Volver a admin" }).click();
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByRole("status").filter({ hasText: "Viendo como" })).toHaveCount(0);
  expect(pushCalls).toEqual([altaDeLaAdmin]);
});

test.describe("admin con el alta de la verificación en dos pasos pendiente", () => {
  // "Salir" está en el encabezado desde 768 px; con el alta pendiente es la
  // única salida a mano (cualquier otra pantalla vuelve al alta).
  test.use({ viewport: { width: 1280, height: 800 } });

  test("el push no la lleva al alta antes de tiempo ni la devuelve ahí al salir", async ({
    page,
  }) => {
    await blockExternalHosts(page);
    await skipSplash(page);
    const pushCalls = await mockBackend(page, { candado: true });
    await page.route("**/api/v1/auth/2fa", (route) =>
      route.fulfill(json({ enabled: false, enabled_at: null, recovery_codes_left: 0 }))
    );
    const cierres: string[] = [];
    page.on("request", (request) => {
      if (request.url().endsWith("/api/v1/auth/logout")) cierres.push(request.method());
    });
    await navegadorConPushActivado(page);
    await registrarServiceWorker(page);

    // Entra y el panel la manda al alta, como siempre. El registro del push
    // salió una vez, el backend lo rechazó y no se repite.
    await ingresar(page, "admin@example.com", /\/admin\/seguridad$/);
    await expect(page.getByRole("button", { name: "Activar la verificación" })).toBeVisible();
    await expect
      .poll(() => pushCalls)
      .toEqual([{ method: "POST", authorization: "Bearer token-de-la-admin", body: SUBSCRIPTION }]);

    // Sale sin activar nada: la respuesta de la baja (otro 403 del candado)
    // llega con la sesión ya cerrada y no la devuelve al alta.
    const pantallas: string[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) pantallas.push(new URL(frame.url()).pathname);
    });
    const baja = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/v1/push/subscribe") && response.request().method() === "DELETE"
    );
    await page.getByRole("button", { name: /^Salir/ }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("link", { name: "Ingresar" }).first()).toBeVisible();
    expect((await baja).status()).toBe(403);
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/$/);
    expect(pantallas).not.toContain("/admin/seguridad");
    expect(cierres).toEqual(["POST"]);
    expect(pushCalls).toHaveLength(2);
  });
});
