import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * F1 (auditoría de producto 2026-08-10): el backend ya soporta filtrar el
 * feed por `urgent` (GET /shifts/feed?urgent=true), pero no había ningún
 * control en `/feed` para usarlo — sólo se veía el badge "Urgente" en la
 * tarjeta. Este spec cubre el chip nuevo "Sólo urgentes".
 */

const WORKER = {
  id: "user-1",
  email: "urgente@staffya.com",
  full_name: "Trabajadora",
  role: "worker",
  status: "activo",
  is_active: true,
  is_verified: true,
};

function shift(id: string, city: string, urgent: boolean) {
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
    urgent,
    address: null,
    city,
    latitude: null,
    longitude: null,
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
        latitude: null,
        longitude: null,
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
  await page.route("**/api/v1/shifts/feed", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        shift("s-normal", "Palermo", false),
        shift("s-urgente", "Recoleta", true),
      ]),
    })
  );
  await page.route("**/api/v1/applications/mine", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
}

test.use({ viewport: { width: 1280, height: 900 } });

test("el chip 'Sólo urgentes' filtra el feed a los turnos urgentes y se puede sacar", async ({
  page,
}) => {
  await skipSplash(page);
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockFeed(page);

  await page.goto("/feed");

  const chip = page.getByRole("switch", { name: /Sólo urgentes/ });
  await expect(chip).toBeVisible();
  await expect(chip).toHaveAttribute("aria-checked", "false");

  // Ambos turnos visibles en la grilla de escritorio antes de filtrar (el
  // mazo mobile también está en el DOM, sólo oculto por CSS — se escopea a
  // la grilla para no chocar con esos duplicados).
  const grid = page.getByTestId("feed-grid-card");
  await expect(grid).toHaveCount(2);
  await expect(grid.filter({ hasText: "Bar Palermo" })).toBeVisible();
  await expect(grid.filter({ hasText: "Bar Recoleta" })).toBeVisible();

  await chip.click();
  await expect(chip).toHaveAttribute("aria-checked", "true");
  await expect(grid).toHaveCount(1);
  await expect(grid.filter({ hasText: "Bar Recoleta" })).toBeVisible();

  await chip.click();
  await expect(chip).toHaveAttribute("aria-checked", "false");
  await expect(grid).toHaveCount(2);
});
