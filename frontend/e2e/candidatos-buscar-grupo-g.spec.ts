import { test, expect, type Page } from "@playwright/test";
import { deContrato } from "./contrato";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * Beta etapa 3, grupo G (U022, U027, U074):
 * - Candidatos de un turno que ya no admite asignar (cancelado, finalizado...)
 *   no ofrece «Elegir» y lo dice.
 * - Candidatos y el perfil del trabajador tienen «volver».
 * - Buscar recuerda rol y radio al volver, y el radio dice «km».
 */

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

// Sesión, postulante y candidato: respuestas reales del backend (e2e/contrato).
const EMPLOYER = deContrato("auth_me_employer");

const [APPLICANT] = deContrato("postulantes", [
  { application_id: "application-1", worker_profile_id: "wp-1", full_name: "Lucía Postulada", rating: 4.8, events_completed: 12, punctuality_rate: 0.95, years_experience: 3 },
]);

const [CANDIDATE] = deContrato("candidatos_recomendados", [
  { profile_id: "worker-profile-2", full_name: "Mateo Sugerido", rating: 4.5, distance_km: 2, score: 80 },
]);

// Turno del comercio dueño, publicado y sin asignar, como lo manda el backend.
function shift(status: string) {
  return deContrato("turno_publicado_comercio", { status });
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

test("turno cancelado: Candidatos no ofrece «Elegir» y avisa el estado", async ({ page }) => {
  await setupCandidatos(page, "cancelado");
  await page.goto("/shifts/shift-1/candidates");
  await expect(page.getByTestId("candidatos-turno-cerrado")).toContainText("cancelado");
  await expect(page.getByText("Lucía Postulada")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Elegir/ })).toHaveCount(0);
  // «Si algo falla» no aplica: ya no se busca a nadie (en las dos pestañas).
  await expect(page.getByText("Si algo falla")).toHaveCount(0);
  await page.getByRole("button", { name: /Recomendados/ }).click();
  await expect(page.getByText("Mateo Sugerido")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Elegir/ })).toHaveCount(0);
  await expect(page.getByText("Si algo falla")).toHaveCount(0);
});

test("turno publicado: «Elegir» sigue, sin aviso, y hay «Volver al panel»", async ({ page }) => {
  await setupCandidatos(page, "publicado");
  await page.goto("/shifts/shift-1/candidates");
  await expect(page.getByRole("button", { name: /^Elegir/ })).toBeVisible();
  await expect(page.getByTestId("candidatos-turno-cerrado")).toHaveCount(0);
  await expect(page.getByText("Si algo falla")).toBeVisible();
  await expect(page.getByRole("link", { name: /Volver al panel/ })).toHaveAttribute("href", "/shifts");
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
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json({ ...EMPLOYER, role: "admin" })));
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

test("perfil sin historial: «Volver» lleva a Buscar", async ({ page }) => {
  await setupCandidatos(page, "publicado");
  await page.route("**/api/v1/workers/wp-1", (r) =>
    r.fulfill(json({ id: "wp-1", user_id: "u-9", full_name: "Lucía Postulada", photo_url: null, city: "Palermo", skills: ["mozo"], years_experience: 3, is_available: true, rating: "4.8", events_completed: 12, punctuality_rate: "0.95", badges: [], level: "bronce", languages: [], certifications: [], bio: null, cv_url: null, cv_filename: null, birth_date: null, age: null, latitude: null, longitude: null, cancellations: 0, no_shows: 0, identidad_verificada: false }))
  );
  await page.route("**/api/v1/favorites/**", (r) => r.fulfill(json({ is_favorite: false })));
  await page.route("**/api/v1/reviews/**", (r) => r.fulfill(json([])));
  await page.route("**/api/v1/matching/search**", (r) => r.fulfill(json([])));
  await page.route("**/api/v1/companies/me/profile", (r) => r.fulfill(json({}, 404)));
  // Entrada directa: el navegador reporta una sola entrada de historial.
  await page.addInitScript(() => {
    Object.defineProperty(History.prototype, "length", { get: () => 1 });
  });
  await page.goto("/workers/wp-1");
  await page.getByRole("button", { name: "Volver" }).click();
  await expect(page).toHaveURL(/\/search/);
});

test("turno asignado: el aviso dice que ya tiene a alguien", async ({ page }) => {
  await setupCandidatos(page, "asignado");
  await page.goto("/shifts/shift-1/candidates");
  await expect(page.getByTestId("candidatos-turno-cerrado")).toContainText("ya tiene a alguien asignado");
  await expect(page.getByRole("button", { name: /^Elegir/ })).toHaveCount(0);
  // Con alguien asignado el turno sigue vivo: la garantía («si no se presenta,
  // reabrís el turno») todavía aplica.
  await expect(page.getByText("Si algo falla")).toBeVisible();
});

test("falla el GET del turno: sin «Elegir» y con error y reintento", async ({ page }) => {
  await setupCandidatos(page, "publicado");
  let falla = true;
  await page.route("**/api/v1/shifts/shift-1", (r) => (falla ? r.fulfill(json({ detail: "x" }, 500)) : r.fulfill(json(shift("publicado")))));
  await page.goto("/shifts/shift-1/candidates");
  await expect(page.getByText("No pudimos cargar el estado del turno")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Elegir/ })).toHaveCount(0);
  falla = false;
  await page.getByRole("button", { name: "Reintentar" }).first().click();
  await expect(page.getByRole("button", { name: /^Elegir/ }).first()).toBeVisible();
});

test("quien no verificó su identidad se ve de entrada y no ofrece «Elegir»", async ({ page }) => {
  await setupCandidatos(page, "publicado");
  await page.route("**/api/v1/applications/shifts/shift-1", (r) =>
    r.fulfill(
      json([
        { ...APPLICANT, falta_verificar: true },
        { ...APPLICANT, application_id: "application-2", worker_profile_id: "wp-2", full_name: "Vera Verificada", identidad_verificada: true, falta_verificar: false },
      ]),
    ),
  );
  await page.goto("/shifts/shift-1/candidates");
  await expect(page.getByText("Lucía Postulada").first()).toBeVisible();
  // Lucía no verificó: lo dice, y no hay botón para elegirla.
  await expect(page.getByTestId("falta-verificar-candidato").first()).toContainText(
    "Todavía no verificó su identidad",
  );
  await expect(page.getByRole("button", { name: /Elegir a Lucía/ })).toHaveCount(0);
  // Vera sí: se la puede elegir.
  await expect(page.getByRole("button", { name: /Elegir a Vera/ })).toBeVisible();
});
