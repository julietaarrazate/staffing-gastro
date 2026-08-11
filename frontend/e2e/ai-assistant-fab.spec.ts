import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * Asistente de turnos por IA como botón flotante global (pedido de Julieta:
 * separado del wizard, "un botón afuera", accesible desde cualquier
 * pantalla del comercio) — antes sólo vivía adentro de /shifts/new. Reusa
 * el mismo `POST /shifts/parse-text`; sólo cambia el punto de entrada: acá
 * el draft se guarda y se navega al wizard, que lo aplica al montar (ver el
 * efecto de handoff en shifts/new/page.tsx).
 */

const EMPLOYER_SESSION = {
  id: "user-1",
  email: "demo.comercio@staffya.com",
  full_name: "Comercio Demo",
  role: "employer",
  status: "activo",
  is_active: true,
  is_verified: true,
};

const WORKER_SESSION = {
  id: "user-2",
  email: "worker.demo@staffya.com",
  full_name: "Trabajador Demo",
  role: "worker",
  status: "activo",
  is_active: true,
  is_verified: true,
};

async function mockSession(page: Page, session: typeof EMPLOYER_SESSION) {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) })
  );
}

test("el comercio puede abrir el asistente flotante desde /shifts y llega al wizard con el turno precargado", async ({
  page,
}) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockSession(page, EMPLOYER_SESSION);
  await page.route("**/api/v1/shifts/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/v1/shifts/parse-text", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        position: "mozo",
        start_at: "2026-08-15T20:00:00-03:00",
        end_at: "2026-08-16T02:00:00-03:00",
        pay_amount: "45000",
        urgent: false,
        meal: false,
        tips: true,
        dress_code: null,
      }),
    })
  );

  await page.goto("/shifts");
  await page.getByRole("button", { name: "Asistente de turnos con IA" }).click();
  await expect(page.getByRole("dialog", { name: "Asistente de turnos" })).toBeVisible();

  await page
    .getByPlaceholder("Ej: necesito un mozo el sábado a la noche, se paga 45000")
    .fill("necesito un mozo el sábado a la noche, se paga 45000");
  await page.getByRole("button", { name: "Completar turno" }).click();

  await expect(page).toHaveURL(/\/shifts\/new/);
  // El puesto ya quedó elegido — "Continuar" está habilitado sin haber
  // tocado ninguna tarjeta a mano en esta pantalla.
  await expect(page.getByRole("button", { name: "Continuar" })).toBeEnabled();
});

test("el botón flotante no aparece en /shifts/new (ya tiene el mismo cuadro integrado)", async ({
  page,
}) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockSession(page, EMPLOYER_SESSION);

  await page.goto("/shifts/new");
  await expect(page.getByRole("button", { name: "Asistente de turnos con IA" })).toHaveCount(0);
});

test("el botón flotante no aparece para un trabajador (sólo el comercio publica turnos)", async ({
  page,
}) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockSession(page, WORKER_SESSION);
  await page.route("**/api/v1/shifts**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  await page.goto("/feed");
  await expect(page.getByRole("button", { name: "Asistente de turnos con IA" })).toHaveCount(0);
});
