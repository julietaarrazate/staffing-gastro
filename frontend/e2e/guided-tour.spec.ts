import { test, expect } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * Mini-tour post-onboarding (`components/GuidedTour.tsx`, pedido de Julieta:
 * "falta las tooltips en onboarding para que sea más guiado"). El
 * trabajador aterriza en `/feed` la primera vez y ve 3 globos señalando el
 * mazo de turnos, el filtro de urgentes y dónde ver sus postulaciones —
 * una sola vez por navegador (`localStorage`).
 *
 * `injectSession` (ver `mocks.ts`) marca este tour como ya visto por
 * defecto para no romper el resto de los specs de `/feed` — acá se limpia
 * esa clave a propósito para ejercitar el flujo real.
 */

const WORKER = {
  id: "user-1",
  email: "tour@staffya.com",
  full_name: "Trabajadora Nueva",
  role: "worker",
  status: "activo",
  is_active: true,
  is_verified: true,
};

async function mockFeed(page: import("@playwright/test").Page) {
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
        years_experience: 0,
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
        {
          id: "s1",
          company_id: "c1",
          position: "mozo",
          quantity: 1,
          start_at: "2026-08-10T20:00:00-03:00",
          end_at: "2026-08-10T23:00:00-03:00",
          pay_amount: "50000",
          currency: "ARS",
          tips: false,
          dress_code: null,
          urgent: true,
          address: null,
          city: "Palermo",
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
          company_name: "Bar Palermo",
          company_logo_url: null,
        },
      ]),
    })
  );
  await page.route("**/api/v1/applications/mine", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
}

test("el tour del feed recorre mazo, filtro y nav, y no vuelve a aparecer", async ({ page }) => {
  await skipSplash(page);
  await injectSession(page);
  // Arranca desde cero: `injectSession` ya lo marcó como visto.
  await page.addInitScript(() => window.localStorage.removeItem("staffya_tour_worker_feed"));
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockFeed(page);

  await page.goto("/feed");

  await expect(page.getByText("Así se ven los turnos")).toBeVisible();
  await page.getByRole("button", { name: "Siguiente" }).click();

  await expect(page.getByText("Los urgentes se cubren rápido")).toBeVisible();
  await page.getByRole("button", { name: "Siguiente" }).click();

  await expect(page.getByText("Acá seguís tus postulaciones")).toBeVisible();
  await page.getByRole("button", { name: "Entendido" }).click();

  await expect(page.getByText("Así se ven los turnos")).not.toBeVisible();
  // El feed sigue siendo usable después de cerrar el tour (nada quedó
  // bloqueando clicks — el mismo síntoma que ya rompió `Sheet`/`Modal`
  // antes de portarlos a `document.body`).
  const chip = page.getByRole("switch", { name: /Sólo urgentes/ });
  await chip.click();
  await expect(chip).toHaveAttribute("aria-checked", "true");

  expect(await page.evaluate(() => localStorage.getItem("staffya_tour_worker_feed"))).toBe("1");

  await page.reload();
  await expect(page.getByText("Así se ven los turnos")).not.toBeVisible();
});

test("saltar el tour lo marca como visto sin terminar los pasos", async ({ page }) => {
  await skipSplash(page);
  await injectSession(page);
  await page.addInitScript(() => window.localStorage.removeItem("staffya_tour_worker_feed"));
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockFeed(page);

  await page.goto("/feed");

  await expect(page.getByText("Así se ven los turnos")).toBeVisible();
  await page.getByRole("button", { name: "Saltar recorrido" }).click();

  await expect(page.getByText("Así se ven los turnos")).not.toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("staffya_tour_worker_feed"))).toBe("1");
});
