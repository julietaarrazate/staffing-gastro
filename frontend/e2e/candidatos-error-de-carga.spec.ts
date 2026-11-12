import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * /shifts/[id]/candidates: si la carga falla NO se muestra «Todavía nadie se
 * postuló» (el comercio podía creer que no hay candidatos y cancelar el turno).
 * Falla de postulados -> error con «Reintentar»; falla sólo de recomendados ->
 * se ven los postulados y un aviso discreto con reintento. El aviso de
 * postulados se ve en las dos pestañas.
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

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

async function setup(
  page: Page,
  opts: { apps: () => ReturnType<typeof json>; cands: () => ReturnType<typeof json> }
) {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json(EMPLOYER)));
  await page.route("**/api/v1/shifts/shift-1", (r) => r.fulfill(json({}, 404)));
  await page.route("**/api/v1/applications/shifts/shift-1", (r) => r.fulfill(opts.apps()));
  await page.route("**/api/v1/shifts/shift-1/candidates", (r) => r.fulfill(opts.cands()));
}

// El anunciador de rutas de Next también es role="alert": se filtra por texto.
const aviso = (page: Page) => page.getByRole("alert").filter({ hasText: "No pudimos" });

const VACIO = "Todavía nadie se postuló";

test("postulados responde 500: error con Reintentar, nunca el vacío; al reintentar aparece la lista", async ({ page }) => {
  let falla = true;
  await setup(page, {
    apps: () => (falla ? json({ detail: "boom" }, 500) : json([APPLICANT])),
    cands: () => json([]),
  });
  await page.goto("/shifts/shift-1/candidates");
  await expect(aviso(page)).toContainText("No pudimos cargar los postulantes");
  await expect(page.getByText(VACIO)).toHaveCount(0);

  falla = false;
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expect(page.getByText("Lucía Postulada")).toBeVisible();
  await expect(aviso(page)).toHaveCount(0);
});

// Aviso discreto de recomendados dentro de Postulantes.
const avisoRecs = (page: Page) => page.getByRole("status").filter({ hasText: "No pudimos cargar los recomendados" });

test("recomendados responde 500 con postulados bien: se ven los postulados, un aviso discreto con reintento y el aviso completo en Recomendados", async ({ page }) => {
  await setup(page, {
    apps: () => json([APPLICANT]),
    cands: () => json({ detail: "boom" }, 500),
  });
  await page.goto("/shifts/shift-1/candidates");
  await expect(page.getByText("Lucía Postulada")).toBeVisible();
  await expect(avisoRecs(page)).toBeVisible();
  await expect(avisoRecs(page).getByRole("button", { name: "Reintentar" })).toBeVisible();
  await expect(aviso(page)).toHaveCount(0);

  await page.getByRole("button", { name: /Recomendados/ }).click();
  await expect(aviso(page)).toContainText("No pudimos cargar los recomendados");
  await expect(page.getByText("Sin recomendados por ahora")).toHaveCount(0);
});

test("entrando por ?tab=recomendados con postulados en 500: el error de postulantes se ve igual", async ({ page }) => {
  await setup(page, {
    apps: () => json({ detail: "boom" }, 500),
    cands: () => json([CANDIDATE]),
  });
  await page.goto("/shifts/shift-1/candidates?tab=recomendados");
  await expect(page.getByText("Mateo Sugerido")).toBeVisible();
  await expect(aviso(page)).toContainText("No pudimos cargar los postulantes");
});

test("el error de postulados no culpa a la conexión (403 u otra falla que no es de red)", async ({ page }) => {
  await setup(page, { apps: () => json({ detail: "x" }, 403), cands: () => json([]) });
  await page.goto("/shifts/shift-1/candidates");
  await expect(aviso(page)).toContainText("No pudimos cargar los postulantes");
  await expect(aviso(page)).not.toContainText("conexión");
  await expect(page.getByText(VACIO)).toHaveCount(0);
});

test("turno ajeno o inexistente (404 en las dos listas): se comporta como antes, vacío y sin aviso", async ({ page }) => {
  await setup(page, { apps: () => json({ detail: "no" }, 404), cands: () => json({ detail: "no" }, 404) });
  await page.goto("/shifts/shift-1/candidates");
  await expect(page.getByText(VACIO)).toBeVisible();
  await expect(aviso(page)).toHaveCount(0);
  await expect(avisoRecs(page)).toHaveCount(0);
});

test("reintentar recomendados no toca los postulados ya cargados y muestra la lista al volver bien", async ({ page }) => {
  let falla = true;
  await setup(page, {
    apps: () => json([APPLICANT]),
    cands: () => (falla ? json({ detail: "boom" }, 500) : json([CANDIDATE])),
  });
  await page.goto("/shifts/shift-1/candidates");
  await expect(page.getByText("Lucía Postulada")).toBeVisible();

  await page.getByRole("button", { name: /Recomendados/ }).click();
  await expect(aviso(page)).toContainText("No pudimos cargar los recomendados");

  falla = false;
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expect(page.getByText("Mateo Sugerido")).toBeVisible();
  await expect(aviso(page)).toHaveCount(0);

  await page.getByRole("button", { name: /Postulantes/ }).click();
  await expect(page.getByText("Lucía Postulada")).toBeVisible();
});

test("turno vacío de verdad (200 con lista vacía) sigue mostrando el vacío", async ({ page }) => {
  await setup(page, { apps: () => json([]), cands: () => json([]) });
  await page.goto("/shifts/shift-1/candidates");
  await expect(page.getByText(VACIO)).toBeVisible();
});
