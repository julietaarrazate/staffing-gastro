import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * "Estoy acá ahora" (lib/current-location.ts).
 *
 * El diseño anterior asumía que trabajás donde vivís: el feed se medía
 * siempre desde la zona fija del perfil. Caso real de Julieta: vive en
 * Palermo, está en Retiro, y un turno en Retiro le quedaba "lejos".
 *
 * El test usa dos turnos en extremos opuestos y verifica que el orden del
 * feed cambia de verdad al compartir la ubicación actual.
 */

// Palermo (zona del perfil) y Retiro (donde está parada ahora).
const PALERMO: [number, number] = [-34.5875, -58.4257];
const RETIRO: [number, number] = [-34.5924, -58.3746];

const WORKER = {
  id: "user-1",
  email: "aca@staffya.com",
  full_name: "Trabajadora",
  role: "worker",
  status: "activo",
  is_active: true,
  is_verified: true,
};

function shift(id: string, city: string, [lat, lng]: [number, number]) {
  return {
    id,
    company_id: "c1",
    position: "mozo",
    quantity: 1,
    start_at: "2026-08-10T20:00:00-03:00",
    end_at: "2026-08-10T23:00:00-03:00",
    pay_amount: "50000",
    currency: "ARS",
    tips: false,
    dress_code: null,
    urgent: false,
    address: null,
    city,
    latitude: lat,
    longitude: lng,
    title: null,
    description: null,
    status: "publicado",
    worker_profile_id: null,
    check_in_latitude: null,
    check_in_longitude: null,
    check_in_at: null,
    check_out_latitude: null,
    check_out_longitude: null,
    check_out_at: null,
    paid_at: null,
    created_at: "2026-07-01T12:00:00-03:00",
    company_name: `Bar ${city}`,
    company_logo_url: null,
  };
}

async function mockFeed(page: Page) {
  await page.route("**/api/v1/auth/me", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(WORKER) })
  );
  await page.route("**/api/v1/workers/me/profile", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "p1",
        user_id: "user-1",
        photo_url: null,
        city: "Palermo, CABA",
        latitude: PALERMO[0],
        longitude: PALERMO[1],
        skills: ["mozo"],
        years_experience: 2,
        is_available: true,
        rating: "0",
        events_completed: 0,
        punctuality_rate: "0",
        cancellations: 0,
        no_shows: 0,
        badges: [],
        level: "bronce",
        created_at: null,
      }),
    })
  );
  // El de Retiro va PRIMERO en la respuesta del backend: así, si el feed no
  // ordenara por cercanía, el test pasaría por casualidad.
  await page.route("**/api/v1/shifts/feed", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        shift("s-retiro", "Retiro", RETIRO),
        shift("s-palermo", "Palermo", PALERMO),
      ]),
    })
  );
  await page.route("**/api/v1/applications/mine", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
}

test("el feed ordena por la zona del perfil, y por dónde estás si lo pedís", async ({
  page,
  context,
}) => {
  await skipSplash(page);
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockFeed(page);

  // El navegador reporta que está en Retiro (permiso ya concedido).
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: RETIRO[0], longitude: RETIRO[1] });

  await page.goto("/feed");

  // Por defecto mide desde la zona del perfil: arriba queda el de Palermo.
  await expect(page.getByText("Turnos cerca de")).toBeVisible();
  await expect(page.getByText("Palermo, CABA")).toBeVisible();
  const deck = page.getByTestId("swipe-deck-card").first();
  await expect(deck).toContainText("Palermo");

  // Al compartir la ubicación actual, el orden se invierte: gana Retiro.
  await page.getByRole("button", { name: "Estoy acá" }).click();
  await expect(page.getByText("donde estás ahora")).toBeVisible();
  await expect(page.getByTestId("swipe-deck-card").first()).toContainText("Retiro");

  // Y se puede volver a la zona del perfil.
  await page.getByRole("button", { name: "Volver a mi zona" }).click();
  await expect(page.getByTestId("swipe-deck-card").first()).toContainText("Palermo");
});
