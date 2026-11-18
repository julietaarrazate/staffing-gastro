import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * Panel del comercio con la persona ya «en camino» pero el estado todavía en
 * `confirmado`: el texto del próximo paso dice que va en camino y, si el
 * turno no tiene coordenadas (no hay mapa), la tarjeta igual lo señala.
 */

function turno(extra: Record<string, unknown>) {
  return {
    id: "shift-sin-mapa",
    company_id: "company-1",
    position: "mozo",
    quantity: 1,
    start_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    end_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    pay_amount: "15000",
    currency: "ARS",
    tips: false,
    urgent: false,
    city: "Palermo, CABA",
    latitude: null,
    longitude: null,
    status: "confirmado",
    worker_profile_id: "wp-1",
    worker_name: "Ana Pérez",
    created_at: "2026-07-01T12:00:00-03:00",
    en_route_latitude: null,
    en_route_longitude: null,
    en_route_at: null,
    ...extra,
  };
}

async function abrirPanel(page: Page, shift: ReturnType<typeof turno>) {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "user-1",
        email: "demo.comercio@staffya.com",
        full_name: "Comercio Demo",
        role: "employer",
        status: "activo",
        is_active: true,
        is_verified: true,
      }),
    })
  );
  await page.route("**/api/v1/shifts/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([shift]) })
  );
  await page.goto("/shifts");
}

test("sin coordenadas y con viaje: dice que va en camino, sin mapa", async ({ page }) => {
  await abrirPanel(page, turno({ en_route_at: new Date().toISOString(), en_route_latitude: -34.6, en_route_longitude: -58.4 }));
  const card = page.locator('[data-shift-id="shift-sin-mapa"]');
  await expect(card.getByTestId("en-route-note")).toContainText("Ana va en camino");
  await expect(card.getByTestId("en-route-note")).toContainText("recién");
  await expect(card.locator(".maplibregl-map")).toHaveCount(0);
  await expect(card.getByText("Ana va en camino al local.")).toBeVisible();
  await expect(card.getByText("Te avisamos cuando salga")).toHaveCount(0);
});

test("viaje apagado: vuelve a «Te avisamos cuando salga»", async ({ page }) => {
  await abrirPanel(page, turno({}));
  const card = page.locator('[data-shift-id="shift-sin-mapa"]');
  await expect(card.getByText("Ana confirmó. Te avisamos cuando salga para allá.")).toBeVisible();
  await expect(card.getByTestId("en-route-note")).toHaveCount(0);
});
