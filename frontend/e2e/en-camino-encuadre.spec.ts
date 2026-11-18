import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * "Va en camino" del comercio (`components/employer/EnRouteMap.tsx`): el
 * encuadre tiene que incluir el local y al trabajador en CADA actualización
 * de posición, también cuando está a más de ~3 km (antes el zoom quedaba fijo
 * en el de la primera posición y el punto salía del recuadro o quedaba
 * cortado contra el borde).
 */

const VENUE = { lat: -34.5875, lng: -58.4257 };

function turno(workerLat: number, workerLng: number) {
  return {
    id: "shift-lejos",
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
    latitude: VENUE.lat,
    longitude: VENUE.lng,
    status: "confirmado",
    worker_profile_id: "wp-1",
    worker_name: "Juana Pérez",
    created_at: "2026-07-01T12:00:00-03:00",
    en_route_latitude: workerLat,
    en_route_longitude: workerLng,
    en_route_at: new Date().toISOString(),
  };
}

/** Los dos marcadores, enteros (con su margen), dentro del recuadro del mapa. */
async function expectAmbosAdentro(page: Page) {
  const mapa = page.locator('[data-shift-id="shift-lejos"] .maplibregl-map');
  const local = mapa.locator(".rounded-\\[4px\\]");
  const persona = mapa.locator("span.rounded-full.bg-primary");
  await expect(local).toHaveCount(1);
  await expect(persona).toHaveCount(1);
  // Deja terminar la animación de cámara (500 ms).
  await page.waitForTimeout(900);
  const caja = (await mapa.boundingBox())!;
  for (const marcador of [local, persona]) {
    const b = (await marcador.boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(caja.x + 8);
    expect(b.y).toBeGreaterThanOrEqual(caja.y + 8);
    expect(b.x + b.width).toBeLessThanOrEqual(caja.x + caja.width - 8);
    expect(b.y + b.height).toBeLessThanOrEqual(caja.y + caja.height - 8);
  }
}

async function prepararComercio(page: Page, obtenerTurno: () => ReturnType<typeof turno>) {
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
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([obtenerTurno()]) })
  );
}

test("el encuadre sigue al trabajador: a 6 km y después a 12 km se ven los dos", async ({ page }) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);

  let turnoActual = turno(VENUE.lat - 0.054, VENUE.lng); // ~6 km al sur
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
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([turnoActual]) })
  );

  await page.clock.install();
  await page.goto("/shifts");
  await expect(page.getByText("Juana Pérez va en camino")).toBeVisible({ timeout: 15_000 });
  await expectAmbosAdentro(page);

  // Se aleja: nueva posición en el próximo refresco del panel.
  turnoActual = turno(VENUE.lat - 0.108, VENUE.lng + 0.05); // ~12 km
  await page.clock.runFor(31_000);
  await expect(page.getByText(/a 12[,.]\d km/)).toBeVisible({ timeout: 10_000 });
  await expectAmbosAdentro(page);
});

test("al salir y volver (mapa reciclado) el encuadre sigue incluyendo a los dos", async ({ page }) => {
  // `MapView` usa `reuseMaps`: al volver a la pantalla el `load` del mapa
  // reciclado llega antes que la referencia, y `EnRouteMap` no recibía el
  // mapa para encuadrar (salió de la revisión de G22).
  await prepararComercio(page, () => turno(VENUE.lat - 0.054, VENUE.lng));
  await page.goto("/shifts");
  await expect(page.getByText("Juana Pérez va en camino")).toBeVisible({ timeout: 15_000 });
  await expectAmbosAdentro(page);

  // Navegación del lado del cliente a otra pantalla y vuelta.
  await page.locator('a[href="/chats"]:visible').first().click();
  await expect(page).toHaveURL(/\/chats/);
  await page.locator('a[href="/shifts"]:visible').first().click();
  await expect(page).toHaveURL(/\/shifts$/);
  await expect(page.getByText("Juana Pérez va en camino")).toBeVisible({ timeout: 15_000 });
  await expectAmbosAdentro(page);
});
