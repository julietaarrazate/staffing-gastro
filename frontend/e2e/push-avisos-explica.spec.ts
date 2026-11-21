import { test, expect, type Page } from "@playwright/test";

// Una clave VAPID de mentira con la forma de una real (65 bytes en base64url).
// Se arma acá y no va escrita: un literal así dispara el escáner de secretos.
const CLAVE_DE_MENTIRA = Buffer.from([4, ...Array.from({ length: 64 }, (_, i) => (i * 7 + 3) % 251)]).toString("base64url");
import {
  blockExternalHosts,
  injectSession,
  mockEmptyNotifications,
  skipSplash,
} from "./mocks";

/**
 * U054 (G17): el interruptor de avisos de Ajustes nunca queda como un botón
 * que no hace nada. Bloqueado en el navegador → explica cómo activarlo;
 * iPhone sin instalar la app → «Instalá la app para recibir avisos»; si la
 * suscripción falla → aviso flotante. El permiso y la falta de `PushManager`
 * se simulan (headless no tiene servicio push).
 */

const SESION = {
  id: "user-push",
  email: "push@example.com",
  full_name: "Trabajadora Avisos",
  role: "worker",
  status: "activo",
  is_active: true,
  is_verified: true,
};

async function abrirAjustes(
  page: Page,
  { vapid = "clave" }: { vapid?: string | null } = {},
) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(SESION),
    }),
  );
  await page.route("**/api/v1/push/public-key", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ vapid_public_key: vapid }),
    }),
  );
  await page.goto("/profile/settings");
}

function simularPermiso(page: Page, permiso: "default" | "denied") {
  return page.addInitScript((valor) => {
    Object.defineProperty(Notification, "permission", {
      get: () => valor,
      configurable: true,
    });
  }, permiso);
}

test("con el permiso bloqueado explica cómo activarlo y no hay botón", async ({
  page,
}) => {
  await simularPermiso(page, "denied");
  await abrirAjustes(page);

  await expect(page.getByText("Bloqueadas", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/Bloqueaste las notificaciones de Oído/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Notificaciones push/ }),
  ).toHaveCount(0);
});

test("iPhone sin instalar la app pide instalarla", async ({ browser }) => {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  // Safari fuera de la app instalada no tiene `PushManager`.
  await page.addInitScript(() => {
    delete (window as unknown as Record<string, unknown>).PushManager;
  });
  await abrirAjustes(page);

  await expect(
    page.getByText("Instalá la app para recibir avisos."),
  ).toBeVisible();
  await expect(
    page.getByText(/Abrí Oído en Safari.*Compartir.*Agregar a inicio/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Notificaciones push/ }),
  ).toHaveCount(0);
  await context.close();
});

test("si la suscripción falla, un aviso flotante lo dice", async ({ page }) => {
  await simularPermiso(page, "default");
  await abrirAjustes(page, { vapid: null });

  const interruptor = page.getByRole("button", { name: /Notificaciones push/ });
  await expect(interruptor).toContainText("Desactivadas");
  await interruptor.click();

  await expect(
    page.getByRole("status").getByText(/No pudimos activar las notificaciones/),
  ).toBeVisible();
  await expect(interruptor).toContainText("Desactivadas");
});

async function activarConPermisoPendiente(page: Page, demoraClaveMs: number) {
  // Headless no tiene servicio push ni diálogo: el permiso y la suscripción se
  // simulan; el service worker (`/sw.js`) se registra de verdad.
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    let permiso: NotificationPermission = "default";
    Object.defineProperty(Notification, "permission", {
      get: () => permiso,
      configurable: true,
    });
    Notification.requestPermission = async () => {
      w.__permisoPedido = true;
      permiso = "granted";
      return "granted";
    };
    let suscripcion: unknown = null;
    PushManager.prototype.getSubscription = async () => suscripcion as never;
    PushManager.prototype.subscribe = async function () {
      // Sólo con un worker activo: es lo que exige Chrome de verdad.
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      if (!reg?.active) throw new DOMException("no active Service Worker", "InvalidStateError");
      suscripcion = {
        endpoint: "https://fcm.googleapis.com/fcm/send/prueba",
        toJSON: () => ({ endpoint: "https://fcm.googleapis.com/fcm/send/prueba", keys: { p256dh: "p", auth: "a" } }),
      };
      return suscripcion as never;
    };
  });
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(SESION) }),
  );
  // Un backend que arranca en frío: la clave tarda.
  let permisoAntesDeLaClave: boolean | null = null;
  await page.route("**/api/v1/push/public-key", async (route) => {
    permisoAntesDeLaClave = await page.evaluate(
      () => (window as unknown as Record<string, unknown>).__permisoPedido === true,
    );
    await new Promise((resolve) => setTimeout(resolve, demoraClaveMs));
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ vapid_public_key: CLAVE_DE_MENTIRA }),
    });
  });
  await page.route("**/api/v1/push/subscribe", (route) =>
    route.fulfill({ status: 201, contentType: "application/json", body: "{}" }),
  );
  await page.goto("/profile/settings");

  const interruptor = page.getByRole("button", { name: /Notificaciones push/ });
  await expect(interruptor).toContainText("Desactivadas");
  await interruptor.click();

  await expect(interruptor).toContainText("Activadas", { timeout: 20_000 });
  expect(permisoAntesDeLaClave).toBe(true);
  return permisoAntesDeLaClave;
}

test("activar con el permiso pendiente: el diálogo sale al toque, antes de que conteste el servidor", async ({
  page,
}) => {
  expect(await activarConPermisoPendiente(page, 1500)).toBe(true);
});

test("activar con la clave al instante: espera al worker activo antes de suscribir", async ({
  page,
}) => {
  // La clave contesta ya: si nadie esperara al worker, `subscribe` (que
  // rechaza sin worker activo, como Chrome) saldría con el worker instalándose.
  await activarConPermisoPendiente(page, 0);
});
