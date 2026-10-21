import { test, expect, type Page } from "@playwright/test";
import {
  blockExternalHosts,
  injectSession,
  mockEmptyNotifications,
  setTheme,
  skipSplash,
} from "./mocks";

/**
 * Panel de admin por secciones (2026-10-20): un menú con contadores de
 * pendientes y la portada "Hoy", que dice qué espera una acción.
 */

const ADMIN_SESSION = {
  id: "admin-1",
  email: "julietaarrazate@gmail.com",
  full_name: "Julieta Arrazate",
  role: "admin",
  status: "active",
  is_active: true,
  is_verified: true,
};

const STATS = {
  total_users: 12,
  workers: 7,
  employers: 4,
  admins: 1,
  active: 11,
  suspended: 1,
  verified: 9,
  coverage_sample_size: 5,
  avg_time_to_fill_minutes: 8,
  pct_filled_under_10_min: 80,
  shift_assignment_rate_sample_size: 0,
  shift_assignment_rate_pct: null,
  shift_completion_rate_sample_size: 0,
  shift_completion_rate_pct: null,
  application_acceptance_sample_size: 0,
  application_to_acceptance_rate_pct: null,
  no_show_sample_size: 0,
  no_show_rate_pct: null,
  worker_completion_repeat_sample_size: 0,
  worker_completion_repeat_rate_pct: null,
  employer_repeat_sample_size: 0,
  employer_repeat_rate_pct: null,
};

const json = (body: unknown) => ({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify(body),
});

async function mockAdmin(page: Page, { tickets = 2 }: { tickets?: number } = {}) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) => route.fulfill(json(ADMIN_SESSION)));
  await page.route("**/api/v1/admin/stats", (route) => route.fulfill(json(STATS)));
  await page.route("**/api/v1/identity/claims/pending", (route) =>
    route.fulfill(
      json(
        // Forma completa de `PendingClaim`: la cola de Verificación la dibuja
        // (sin `evidences` la pantalla se rompía al llegar los datos).
        ["Ana", "Beto", "Caro"].map((name, i) => ({
          claim_id: `c${i}`,
          user_id: `u${i}`,
          claim_type: "documento_verificado",
          full_name: `${name} Prueba`,
          company_name: null,
          submitted_at: "2026-10-20T12:00:00Z",
          evidences: [],
        }))
      )
    )
  );
  await page.route("**/api/v1/support/tickets?**", (route) =>
    route.fulfill(json(Array.from({ length: tickets }, (_, i) => ({ id: `t${i}` }))))
  );
  await page.route("**/api/v1/admin/leads/summary**", (route) =>
    route.fulfill(
      json({
        counts: { nuevo: 14, contactado: 3, visitado: 0, interesado: 1, alta: 0, descartado: 2 },
        total: 20,
      })
    )
  );
}

test("Hoy muestra los pendientes con contador y lleva a cada sección", async ({ page }) => {
  await mockAdmin(page);
  await page.goto("/admin");

  await expect(page.getByRole("heading", { name: "Hola, Julieta" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Secciones del panel" });
  await expect(nav.getByRole("link", { name: "Hoy" })).toHaveAttribute("aria-current", "page");
  // Contadores del menú: 3 identidades y 2 tickets.
  await expect(nav.getByRole("link", { name: "Verificación 3" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Soporte 2" })).toBeVisible();

  await expect(page.getByText("Identidades por verificar")).toBeVisible();
  await expect(page.getByText("14")).toBeVisible();
  await expect(page.getByText("8 min")).toBeVisible();
  await expect(page.getByText("80%")).toBeVisible();

  await page.getByRole("link", { name: /Identidades por verificar/ }).click();
  await expect(page).toHaveURL("/admin/verificacion");
  await expect(page.getByRole("heading", { name: "Verificación" })).toBeVisible();
});

test("sin pendientes, Hoy dice que está al día", async ({ page }) => {
  await mockAdmin(page, { tickets: 0 });
  await page.goto("/admin");
  await expect(page.getByRole("link", { name: /Tickets de soporte abiertos/ })).toContainText("Al día");
  await expect(
    page.getByRole("navigation", { name: "Secciones del panel" }).getByRole("link", { name: "Soporte" })
  ).toHaveText("Soporte");
});

test("un trabajador no ve el panel", async ({ page }) => {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill(json({ ...ADMIN_SESSION, id: "w1", role: "worker" }))
  );
  await page.goto("/admin/personas");
  await expect(page.getByText("Acceso restringido")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Secciones del panel" })).toHaveCount(0);
});

for (const theme of ["light", "dark"] as const) {
  for (const viewport of [
    { name: "celular", width: 390, height: 844 },
    { name: "compu", width: 1280, height: 900 },
  ]) {
    test(`captura de Hoy en ${theme}, ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setTheme(page, theme);
      await mockAdmin(page);
      await page.goto("/admin");
      await expect(page.getByText("80%")).toBeVisible();
      await page.screenshot({
        path: `test-results/admin-hoy-${theme}-${viewport.name}.png`,
        fullPage: true,
      });
    });
  }
}
