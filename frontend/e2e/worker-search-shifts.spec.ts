import { test, expect } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * Pestaña "Buscar" del trabajador (`/buscar`, pedido de Julieta: "agregar la
 * pestaña Buscar (trabajador)"): a diferencia del feed, que sólo trae los
 * rubros del perfil, acá se navega el mercado completo por categoría y se
 * puede postular igual que desde el feed.
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
};

function shift(id: string, position: string) {
  return {
    id,
    company_id: "company-1",
    company_name: "Bar Central",
    company_logo_url: null,
    position,
    quantity: 2,
    start_at: "2026-09-05T20:00:00-03:00",
    end_at: "2026-09-06T02:00:00-03:00",
    pay_amount: "15000",
    currency: "ARS",
    tips: true,
    meal: false,
    dress_code: null,
    urgent: false,
    city: "Palermo, CABA",
    latitude: -34.588,
    longitude: -58.43,
    status: "publicado",
    created_at: "2026-09-01T12:00:00-03:00",
  };
}

test("un worker navega turnos de cualquier rubro por categoría y se postula", async ({
  page,
}) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);

  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(WORKER_SESSION) })
  );
  await page.route("**/api/v1/workers/me/profile", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(WORKER_PROFILE) })
  );
  await page.route("**/api/v1/applications/mine", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  // El perfil del trabajador es sólo "mozo", pero acá se ve TAMBIÉN
  // "bartender": la pestaña Buscar no se limita a los rubros del perfil
  // (eso ya lo hace el feed) — pasa explícitamente TODOS los rubros como
  // `positions` para traer el mercado completo.
  await page.route("**/api/v1/shifts/feed**", (route) => {
    const url = new URL(route.request().url());
    const position = url.searchParams.get("position");
    const all = [shift("shift-mozo", "mozo"), shift("shift-bartender", "bartender")];
    const body = position ? all.filter((s) => s.position === position) : all;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  let applyCalled = false;
  await page.route("**/api/v1/applications/shifts/shift-bartender", (route) => {
    if (route.request().method() === "POST") {
      applyCalled = true;
      return route.fulfill({ status: 201, contentType: "application/json", body: "{}" });
    }
    return route.continue();
  });

  await page.goto("/buscar");

  // "Todos" (default): aparecen turnos de los dos rubros, no sólo "mozo"
  // (el rubro del perfil) — es la diferencia con el feed. Título de tarjeta
  // (heading), no el chip del filtro: el chip también dice "Mozo/a"/"Bartender".
  await expect(page.getByRole("heading", { name: "Mozo/a" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bartender" })).toBeVisible();

  // Filtrar por categoría: el chip "Bartender" reenvía con `position`
  // explícito y la grilla se achica a sólo ese rubro.
  await page.getByRole("button", { name: "Bartender" }).click();
  await expect(page.getByRole("heading", { name: "Mozo/a" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Bartender" })).toBeVisible();

  const applyResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/v1/applications/shifts/shift-bartender") &&
      res.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Postularme" }).click();
  await applyResponse;

  expect(applyCalled).toBe(true);
});
