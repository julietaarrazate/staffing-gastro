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
  "primera@example.com": { token: "token-de-la-primera", id: "user-primera" },
  "segunda@example.com": { token: "token-de-la-segunda", id: "user-segunda" },
} as const;
type Email = keyof typeof CUENTAS;

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
    role: "worker",
    status: "activo",
    is_active: true,
    is_verified: true,
  };
}

async function mockBackend(page: Page): Promise<PushCall[]> {
  const pushCalls: PushCall[] = [];

  // Lo que no importa para esta prueba (las pantallas a las que cae el
  // ingreso) contesta 404 en vez de salir a la red.
  await page.route("**/api/v1/**", (route) => route.fulfill(json({ detail: "sin mock" }, 404)));
  await mockEmptyNotifications(page);

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
    return request.method() === "DELETE"
      ? route.fulfill({ status: 204 })
      : route.fulfill(json({ ok: true }, 201));
  });

  return pushCalls;
}

async function ingresar(page: Page, email: Email) {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Contraseña").fill("una-clave-cualquiera");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/feed$/);
}

test("el push pasa a la cuenta que entra y se da de baja al cerrar sesión", async ({ page }) => {
  await blockExternalHosts(page);
  await skipSplash(page);
  const pushCalls = await mockBackend(page);
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

  // El navegador ya tenía las notificaciones activadas de antes.
  await page.goto("/login");
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
  });
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
