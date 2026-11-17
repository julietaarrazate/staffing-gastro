import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * Beta etapa 3, grupo G (U022, U027, U074):
 * - Candidatos de un turno que ya no admite asignar (cancelado, finalizado...)
 *   no ofrece «Asignar» y lo dice.
 * - Candidatos y el perfil del trabajador tienen «volver».
 * - Buscar recuerda rol y radio al volver, y el radio dice «km».
 */

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

const EMPLOYER = {
  id: "user-1",
  email: "demo.comercio@staffya.com",
  full_name: "Comercio Demo",
  role: "employer",
  status: "activo",
  is_active: true,
  is_verified: true,
};

const APPLICANT = {
  application_id: "app-1",
  worker_profile_id: "wp-1",
  full_name: "Lucía Postulada",
  photo_url: null,
  rating: 4.8,
  is_available: true,
  status: "pendiente",
  created_at: "2026-11-10T12:00:00-03:00",
  events_completed: 12,
  punctuality_rate: 0.95,
  years_experience: 3,
  badges: [],
  level: "bronce",
};

const CANDIDATE = {
  profile_id: "wp-2",
  full_name: "Mateo Sugerido",
  photo_url: null,
  rating: 4.5,
  distance_km: 2,
  score: 80,
};

function shift(status: string) {
  return {
    id: "shift-1",
    company_id: "c1",
    position: "mozo",
    quantity: 1,
    start_at: "2026-12-10T20:00:00-03:00",
    end_at: "2026-12-10T23:00:00-03:00",
    pay_amount: "50000",
    currency: "ARS",
    tips: false,
    dress_code: null,
    urgent: false,
    address: null,
    city: "Palermo",
    latitude: null,
    longitude: null,
    title: null,
    description: null,
    status,
    worker_profile_id: null,
    created_at: "2026-11-01T12:00:00-03:00",
    company_name: "Bar Demo",
    company_logo_url: null,
  };
}

async function setupCandidatos(page: Page, status: string) {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json(EMPLOYER)));
  await page.route("**/api/v1/shifts/shift-1", (r) => r.fulfill(json(shift(status))));
  await page.route("**/api/v1/applications/shifts/shift-1", (r) => r.fulfill(json([APPLICANT])));
  await page.route("**/api/v1/shifts/shift-1/candidates", (r) => r.fulfill(json([CANDIDATE])));
}

test("turno cancelado: Candidatos no ofrece «Asignar» y avisa el estado", async ({ page }) => {
  await setupCandidatos(page, "cancelado");
  await page.goto("/shifts/shift-1/candidates");
  await expect(page.getByTestId("candidatos-turno-cerrado")).toContainText("cancelado");
  await expect(page.getByText("Lucía Postulada")).toBeVisible();
  await expect(page.getByRole("button", { name: "Asignar" })).toHaveCount(0);
  await page.getByRole("button", { name: /Recomendados/ }).click();
  await expect(page.getByText("Mateo Sugerido")).toBeVisible();
  await expect(page.getByRole("button", { name: "Asignar" })).toHaveCount(0);
});

test("turno publicado: «Asignar» sigue, sin aviso, y hay «Mis turnos» para volver", async ({ page }) => {
  await setupCandidatos(page, "publicado");
  await page.goto("/shifts/shift-1/candidates");
  await expect(page.getByRole("button", { name: "Asignar" })).toBeVisible();
  await expect(page.getByTestId("candidatos-turno-cerrado")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Mis turnos/ })).toHaveAttribute("href", "/shifts");
});

test("el perfil del trabajador tiene «Volver» y retrocede", async ({ page }) => {
  await setupCandidatos(page, "publicado");
  await page.route("**/api/v1/workers/wp-1", (r) =>
    r.fulfill(
      json({
        id: "wp-1",
        user_id: "u-9",
        full_name: "Lucía Postulada",
        photo_url: null,
        city: "Palermo, CABA",
        skills: ["mozo"],
        years_experience: 3,
        is_available: true,
        rating: "4.8",
        events_completed: 12,
        punctuality_rate: "0.95",
        badges: [],
        level: "bronce",
        languages: [],
        certifications: [],
        bio: null,
        cv_url: null,
        cv_filename: null,
        birth_date: null,
        age: null,
        latitude: null,
        longitude: null,
        cancellations: 0,
        no_shows: 0,
        identidad_verificada: false,
      })
    )
  );
  await page.route("**/api/v1/favorites/**", (r) => r.fulfill(json({ is_favorite: false })));
  await page.route("**/api/v1/reviews/**", (r) => r.fulfill(json([])));
  await page.goto("/shifts/shift-1/candidates");
  await page.getByRole("link", { name: "Lucía Postulada" }).last().click();
  await expect(page).toHaveURL(/\/workers\/wp-1/);
  await page.getByRole("button", { name: "Volver" }).click();
  await expect(page).toHaveURL(/\/shifts\/shift-1\/candidates/);
});

test("Buscar recuerda rol y radio al volver y el radio dice «km»", async ({ page }) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json({ ...EMPLOYER, role: "worker" })));
  await page.route("**/api/v1/matching/search**", (r) => r.fulfill(json([])));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/search");
  const aside = page.locator("aside");
  await expect(aside.getByText("km", { exact: true })).toBeVisible();
  await aside.locator("select").selectOption("barista");
  await aside.locator("input[type=number]").fill("30");
  await page.goto("/search");
  await expect(aside.locator("select")).toHaveValue("barista");
  await expect(aside.locator("input[type=number]")).toHaveValue("30");
});
