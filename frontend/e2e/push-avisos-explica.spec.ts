import { test, expect, type Page } from "@playwright/test";
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
  await expect(page.getByText(/Compartir.*Agregar a inicio/)).toBeVisible();
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
