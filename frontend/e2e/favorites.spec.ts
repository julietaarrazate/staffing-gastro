import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * "Favoritos y recontratación" (auditoría de producto 2026-08-10): el
 * comercio marca a un trabajador para encontrarlo rápido la próxima vez.
 * Cubre el listado (`/favorites`) y el toggle en el perfil del trabajador
 * (`/workers/[id]`), ambos con la API mockeada (sin backend real en CI).
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

const FAVORITE_WORKER = {
  worker_profile_id: "wp-1",
  full_name: "Juana Pérez",
  photo_url: null,
  rating: 4.5,
  skills: ["mozo"],
  is_available: true,
  events_completed: 3,
  shifts_together: 2,
  favorited_at: "2026-08-01T12:00:00-03:00",
};

const WORKER_PROFILE = {
  id: "wp-1",
  user_id: "user-2",
  full_name: "Juana Pérez",
  photo_url: null,
  birth_date: null,
  age: null,
  city: "Palermo",
  bio: null,
  latitude: null,
  longitude: null,
  skills: ["mozo"],
  years_experience: 2,
  languages: [],
  certifications: [],
  cv_url: null,
  is_available: true,
  rating: 4.5,
  events_completed: 3,
  punctuality_rate: 1,
  cancellations: 0,
  no_shows: 0,
  badges: [],
  level: "bronce",
  identidad_verificada: false,
};

async function mockEmployerSession(page: Page) {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(EMPLOYER_SESSION) })
  );
}

test("lista de favoritos: muestra al trabajador y 'Quitar' lo saca de la lista", async ({ page }) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockEmployerSession(page);

  let removed = false;
  await page.route("**/api/v1/favorites", (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(removed ? [] : [FAVORITE_WORKER]),
    });
  });
  await page.route("**/api/v1/favorites/wp-1", (route) => {
    if (route.request().method() === "DELETE") {
      removed = true;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ is_favorite: false }),
      });
    }
    return route.continue();
  });

  await page.goto("/favorites");
  await expect(page.getByText("Juana Pérez")).toBeVisible();
  await expect(page.getByText("2 turnos juntos")).toBeVisible();

  await page.getByRole("button", { name: "Quitar" }).click();
  await expect(page.getByText("Todavía no marcaste favoritos")).toBeVisible();
});

test("perfil del trabajador: el comercio puede marcarlo como favorito", async ({ page }) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockEmployerSession(page);

  await page.route("**/api/v1/workers/wp-1", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(WORKER_PROFILE) })
  );
  await page.route("**/api/v1/reviews/workers/wp-1*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  let isFavorite = false;
  await page.route("**/api/v1/favorites/wp-1/status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ is_favorite: isFavorite }),
    })
  );
  await page.route("**/api/v1/favorites/wp-1", (route) => {
    if (route.request().method() === "PUT") {
      isFavorite = true;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ is_favorite: true }),
      });
    }
    return route.continue();
  });

  await page.goto("/workers/wp-1");
  const toggle = page.getByRole("button", { name: "Agregar a favoritos" });
  await expect(toggle).toBeVisible();

  await toggle.click();
  await expect(page.getByRole("button", { name: "Favorito" })).toBeVisible();
});
