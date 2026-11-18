import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * Cancelar un evento entero (U084): un botón en la fila del evento, con las
 * mismas reglas que cancelar cada puesto. El diálogo dice cuántos puestos se
 * cancelan y cuántas cancelaciones tardías suma, antes de confirmar.
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

function puesto(id: string, status: string, worker = false) {
  return {
    id,
    company_id: "company-1",
    position: "mozo",
    quantity: 1,
    start_at: "2026-12-20T20:00:00-03:00",
    end_at: "2026-12-21T02:00:00-03:00",
    pay_amount: "15000",
    currency: "ARS",
    tips: false,
    dress_code: null,
    urgent: false,
    address: null,
    city: "Palermo, CABA",
    latitude: null,
    longitude: null,
    title: "Boda Martínez",
    description: null,
    status,
    worker_profile_id: worker ? `wp-${id}` : null,
    worker_name: worker ? "Trabajador Demo" : null,
    event_id: "evento-1",
    event_name: "Boda Martínez",
    created_at: "2026-12-01T12:00:00-03:00",
    company_name: null,
    company_logo_url: null,
  };
}

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

async function mockPanel(page: Page, getShifts: () => unknown[]) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) => route.fulfill(json(EMPLOYER_SESSION)));
  await page.route("**/api/v1/shifts/me", (route) => route.fulfill(json(getShifts())));
}

test("cancelar el evento avisa la tardía antes y cancela todos los puestos", async ({ page }) => {
  let shifts = [
    puesto("s1", "confirmado", true),
    puesto("s2", "buscando_personal"),
    puesto("s3", "cancelado"),
  ];
  await mockPanel(page, () => shifts);
  let cancelled = 0;
  await page.route("**/api/v1/shifts/events/evento-1/cancel", (route) => {
    cancelled += 1;
    shifts = shifts.map((s) => ({ ...s, status: "cancelado" }));
    return route.fulfill(json({ event_id: "evento-1", cancelled: shifts.slice(0, 2) }));
  });

  await page.goto("/shifts");
  await page.getByRole("button", { name: "Cancelar el evento Boda Martínez" }).click();

  const dialog = page.getByRole("dialog", { name: "¿Cancelar el evento entero?" });
  await expect(dialog).toContainText("Se cancelan los 2 puestos que quedan del evento.");
  await expect(dialog).toContainText(
    "Una persona ya confirmó: te suma una cancelación tardía. La ves en tu perfil."
  );
  await dialog.getByRole("button", { name: "Sí, cancelar evento" }).click();

  await expect(page.getByText("Cancelaste el evento.")).toBeVisible();
  expect(cancelled).toBe(1);
  // Con todo cancelado, la fila del evento (y su botón) desaparece.
  await expect(page.getByRole("button", { name: "Cancelar el evento Boda Martínez" })).toHaveCount(0);
});

test("un evento ya terminado no ofrece cancelar", async ({ page }) => {
  await mockPanel(page, () => [puesto("s1", "pagado", true), puesto("s2", "finalizado", true)]);
  await page.goto("/shifts");
  await expect(page.getByText("2/2 cubiertos")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancelar el evento Boda Martínez" })).toHaveCount(0);
});
