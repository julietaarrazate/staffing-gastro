import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * El contador del evento en «Mis turnos» (U083): «N/M cubiertos» no cuenta los
 * cancelados, y «cubiertos» son los confirmados en adelante, no los asignados
 * que todavía no confirmaron.
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

function puesto(id: string, position: string, status: string, worker = false) {
  return {
    id,
    company_id: "company-1",
    position,
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

const json = (body: unknown) => ({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify(body),
});

async function mockPanel(page: Page, shifts: unknown[]) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) => route.fulfill(json(EMPLOYER_SESSION)));
  await page.route("**/api/v1/shifts/me", (route) => route.fulfill(json(shifts)));
}

test("el contador del evento no cuenta cancelados ni asignados sin confirmar", async ({ page }) => {
  await mockPanel(page, [
    puesto("s1", "mozo", "confirmado", true),
    puesto("s2", "mozo", "pagado", true),
    puesto("s3", "bartender", "asignado", true),
    puesto("s4", "bartender", "buscando_personal"),
    puesto("s5", "mozo", "cancelado"),
    puesto("s6", "cocinero", "cancelado"),
  ]);
  await page.goto("/shifts");
  await expect(page.getByText("2/4 cubiertos")).toBeVisible();
});

test("un evento con todos los puestos cancelados no muestra contador", async ({ page }) => {
  await mockPanel(page, [puesto("s1", "mozo", "cancelado"), puesto("s2", "mozo", "cancelado")]);
  await page.goto("/shifts");
  await expect(page.getByText(/cubiertos/)).toHaveCount(0);
});
