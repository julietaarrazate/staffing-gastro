import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * «Sin reseñas no es cero» (U020): quien todavía no tiene reseñas no tiene
 * nota. Nunca «0,0», estrellas vacías ni «Puntualidad 0 %». Ver
 * `lib/reputation.tsx` (hasRating / hasRate).
 */

const EMPLOYER = {
  id: "user-1",
  email: "demo.comercio@staffya.com",
  full_name: "Comercio Demo",
  role: "employer",
  status: "activo",
  is_active: true,
  is_verified: true,
};

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

const perfil = (over: Record<string, unknown>) => ({
  id: "wp-1",
  user_id: "user-2",
  full_name: "Persona Perfil",
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
  rating: 0,
  events_completed: 0,
  punctuality_rate: 0,
  cancellations: 0,
  no_shows: 0,
  badges: [],
  level: "bronce",
  identidad_verificada: false,
  ...over,
});

const NUEVA = { id: "wp-nueva", full_name: "Nueva Sinhistoria" };
const VETERANA = {
  id: "wp-vet",
  full_name: "Vera Veterana",
  rating: 4.6,
  events_completed: 12,
  punctuality_rate: 0.95,
};

async function setup(page: Page) {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json(EMPLOYER)));
  await page.route("**/api/v1/favorites/*/status", (r) => r.fulfill(json({ is_favorite: false })));
  await page.route("**/api/v1/reviews/**", (r) => r.fulfill(json([])));
  await page.route("**/api/v1/workers/wp-nueva", (r) => r.fulfill(json(perfil(NUEVA))));
  await page.route("**/api/v1/workers/wp-vet", (r) => r.fulfill(json(perfil(VETERANA))));
}

test("perfil público: persona nueva sin 0,0 ni Puntualidad; con historial, nota y puntualidad", async ({ page }) => {
  await setup(page);

  await page.goto("/workers/wp-nueva");
  await expect(page.getByRole("heading", { name: /Nueva Sinhistoria/ })).toBeVisible();
  await expect(page.getByText("Nuevo en Oído")).toBeVisible();
  await expect(page.getByText("Puntualidad", { exact: true })).toHaveCount(0);
  const cuerpo = (await page.locator("main").innerText()) + "";
  expect(cuerpo).not.toMatch(/0[.,]0\b/);
  await expect(page.getByRole("button", { name: /estrella/ })).toHaveCount(0);

  await page.goto("/workers/wp-vet");
  await expect(page.getByRole("heading", { name: /Vera Veterana/ })).toBeVisible();
  await expect(page.getByText("4,6", { exact: true })).toBeVisible();
  await expect(page.getByText("Puntualidad", { exact: true })).toBeVisible();
  await expect(page.getByText("95%", { exact: true })).toBeVisible();
  await expect(page.getByText("Nuevo en Oído")).toHaveCount(0);
});

const POSTULANTE = (over: Record<string, unknown>) => ({
  application_id: "app-x",
  worker_profile_id: "wp-x",
  full_name: "X",
  photo_url: null,
  rating: 0,
  is_available: true,
  status: "pendiente",
  created_at: "2026-11-10T12:00:00-03:00",
  events_completed: 0,
  punctuality_rate: 0,
  years_experience: 0,
  badges: [],
  level: "bronce",
  ...over,
});

test("candidatos: la persona nueva dice «Nuevo en Oído» y la veterana muestra nota y puntualidad", async ({ page }) => {
  await setup(page);
  await page.route("**/api/v1/shifts/shift-1", (r) => r.fulfill(json({}, 404)));
  await page.route("**/api/v1/shifts/shift-1/candidates", (r) => r.fulfill(json([])));
  await page.route("**/api/v1/applications/shifts/shift-1", (r) =>
    r.fulfill(
      json([
        POSTULANTE({ application_id: "a1", worker_profile_id: "wp-nueva", full_name: "Nueva Sinhistoria" }),
        POSTULANTE({
          application_id: "a2",
          worker_profile_id: "wp-vet",
          full_name: "Vera Veterana",
          rating: 4.6,
          events_completed: 12,
          punctuality_rate: 0.95,
          years_experience: 3,
        }),
      ])
    )
  );
  await page.goto("/shifts/shift-1/candidates");
  await expect(page.getByText("Nueva Sinhistoria")).toBeVisible();
  await expect(page.getByText("Nuevo en Oído")).toHaveCount(1);
  await expect(page.getByText("4,6")).toBeVisible();
  await expect(page.getByText("95% puntual")).toBeVisible();
  const cuerpo = await page.locator("main").innerText();
  expect(cuerpo).not.toMatch(/0[.,]0\b|\b0%/);
});

test("Buscar trabajadores: la persona nueva no muestra estrellas ni 0,0", async ({ page }) => {
  await setup(page);
  await page.route("**/api/v1/matching/search**", (r) =>
    r.fulfill(
      json([
        { profile_id: "wp-nueva", user_id: "u1", full_name: "Nueva Sinhistoria", photo_url: null, rating: 0, distance_km: 0.8, latitude: -34.6, longitude: -58.38, skills: ["mozo"], is_live: false, position_updated_at: null },
        { profile_id: "wp-vet", user_id: "u2", full_name: "Vera Veterana", photo_url: null, rating: 4.6, distance_km: 1.2, latitude: -34.61, longitude: -58.39, skills: ["mozo"], is_live: false, position_updated_at: null },
      ])
    )
  );
  await page.goto("/search");
  const fila = (nombre: string) =>
    page.locator("div.flex-1").filter({ hasText: nombre }).filter({ visible: true }).last();
  await expect(page.getByText("Nueva Sinhistoria").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText("Nuevo en Oído").filter({ visible: true })).toHaveCount(1);
  await expect(page.getByText("4,6").filter({ visible: true }).first()).toBeVisible();
  await expect(fila("Nueva Sinhistoria")).not.toContainText("0,0");
  await expect(fila("Nueva Sinhistoria")).toContainText("0,8 km");
});

const comercio = (over: Record<string, unknown>) => ({
  id: "c-1",
  user_id: "user-9",
  owner_full_name: null,
  name: "Bar Demo",
  logo_url: null,
  category: "bar",
  description: null,
  address: null,
  city: "Palermo",
  latitude: null,
  longitude: null,
  capacity: null,
  opening_hours: null,
  rating: 0,
  events_published: 0,
  on_time_payment_rate: 0,
  late_cancellations: 0,
  payments_recorded: 0,
  ...over,
});

test("perfil del comercio: con turnos pero sin pagos no hay «Pago a tiempo» ni 0 %; con pagos sí", async ({ page }) => {
  await setup(page);
  await page.route("**/api/v1/companies/c-nuevo", (r) =>
    r.fulfill(json(comercio({ id: "c-nuevo", name: "Bar Nuevo", events_published: 3 })))
  );
  await page.route("**/api/v1/companies/c-hist", (r) =>
    r.fulfill(
      json(comercio({ id: "c-hist", name: "Bar Historia", rating: 4.2, events_published: 9, on_time_payment_rate: 0.9, payments_recorded: 7 }))
    )
  );

  await page.goto("/companies/c-nuevo");
  await expect(page.getByRole("heading", { name: "Bar Nuevo" })).toBeVisible();
  await expect(page.getByText("3 turnos publicados")).toBeVisible();
  await expect(page.getByText("Nuevo en Oído")).toHaveCount(0);
  await expect(page.getByText("Pago a tiempo")).toHaveCount(0);
  expect(await page.locator("main").innerText()).not.toMatch(/0[.,]0\b|\b0%/);

  await page.goto("/companies/c-hist");
  await expect(page.getByRole("heading", { name: "Bar Historia" })).toBeVisible();
  await expect(page.getByText("Pago a tiempo")).toBeVisible();
  await expect(page.getByText("90%")).toBeVisible();
  await expect(page.getByText("4,2", { exact: true })).toBeVisible();
});

test("perfil público: con turnos y sin reseñas no dice «Nuevo en Oído» junto a «3 eventos»", async ({ page }) => {
  await setup(page);
  await page.route("**/api/v1/workers/wp-turnos", (r) =>
    r.fulfill(json(perfil({ id: "wp-turnos", full_name: "Tomás Turnos", events_completed: 3, punctuality_rate: 1 })))
  );
  await page.goto("/workers/wp-turnos");
  await expect(page.getByRole("heading", { name: /Tomás Turnos/ })).toBeVisible();
  await expect(page.getByText("3 eventos")).toBeVisible();
  await expect(page.getByText("Nuevo en Oído")).toHaveCount(0);
  await expect(page.getByText("· 3 eventos")).toHaveCount(0);
});
