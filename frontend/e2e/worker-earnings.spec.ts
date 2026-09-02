import { test, expect } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * Ganancias del trabajador (pedido de Julieta: "un resumen de ganancias
 * acumuladas en el perfil ... por mes"): `WorkerGameCard` (`/profile`)
 * suma un bloque con el total y lo del mes actual, además de la
 * reputación/puntualidad/insignias que ya mostraba.
 */

const WORKER_SESSION = {
  id: "user-1",
  email: "demo.mozo@staffya.com",
  full_name: "Mozo Demo",
  role: "worker",
  status: "activo",
  is_active: true,
  is_verified: true,
};

const WORKER_PROFILE = {
  id: "profile-1",
  user_id: "user-1",
  full_name: "Mozo Demo",
  photo_url: null,
  birth_date: null,
  age: null,
  city: "Palermo, CABA",
  bio: null,
  latitude: -34.5875,
  longitude: -58.4257,
  skills: ["mozo"],
  years_experience: 2,
  languages: [],
  certifications: [],
  cv_url: null,
  is_available: true,
  rating: 4.8,
  events_completed: 6,
  punctuality_rate: 0.95,
  cancellations: 0,
  no_shows: 0,
  badges: [],
  level: "plata",
  identidad_verificada: true,
};

test("el perfil del trabajador muestra ganancias totales y del mes", async ({ page }) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);

  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(WORKER_SESSION) })
  );
  await page.route("**/api/v1/workers/me/profile", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(WORKER_PROFILE) })
  );
  await page.route("**/api/v1/workers/me/earnings", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        total_earned: "245000.00",
        this_month_earned: "80000.00",
        shifts_completed: 6,
      }),
    })
  );
  await page.route("**/api/v1/reviews/received", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/v1/identity/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ claims: [] }),
    })
  );

  await page.goto("/profile");

  await expect(page.getByText("Ganado este mes")).toBeVisible();
  await expect(page.getByText("80.000")).toBeVisible();
  await expect(page.getByText("245.000")).toBeVisible();
});

test("sin ganancias todavía, el perfil se ve completo igual (el bloque no rompe nada)", async ({
  page,
}) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);

  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(WORKER_SESSION) })
  );
  await page.route("**/api/v1/workers/me/profile", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...WORKER_PROFILE, events_completed: 0, level: "bronce" }),
    })
  );
  // Falla el fetch de ganancias (ej. perfil recién creado, pero simulamos
  // un 500 real): la tarjeta entera no debe romperse por esto.
  await page.route("**/api/v1/workers/me/earnings", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: "{}" })
  );
  await page.route("**/api/v1/reviews/received", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/v1/identity/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ claims: [] }),
    })
  );

  await page.goto("/profile");

  await expect(page.getByText("Nivel Bronce").first()).toBeVisible();
  await expect(page.getByText("Ganado este mes")).toHaveCount(0);
});
