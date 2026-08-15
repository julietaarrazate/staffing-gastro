import { test, expect } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * Sección "Suscripciones" del panel de admin (segunda mitad del pedido de
 * Julieta de un dashboard operacional): MRR real y distribución de
 * comercios por plan, servidos por `GET /admin/subscription-stats`.
 */

const ADMIN_SESSION = {
  id: "admin-1",
  email: "julietaarrazate@gmail.com",
  full_name: "Julieta Admin",
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
  coverage_sample_size: 0,
  avg_time_to_fill_minutes: null,
  pct_filled_under_10_min: null,
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

const SUBSCRIPTION_STATS = {
  mrr_ars: "65000",
  total_companies: 4,
  companies_by_plan: { gratis: 2, basico: 1, pro: 1 },
  companies_at_plan_limit: 1,
  billing_enabled: true,
};

async function mockAdminShell(page: import("@playwright/test").Page) {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ADMIN_SESSION) })
  );
  await page.route("**/api/v1/admin/stats", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(STATS) })
  );
  await page.route("**/api/v1/admin/users", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/v1/admin/test-accounts", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/v1/identity/claims/pending", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
}

test("con el cobro activo, la sección Suscripciones muestra el MRR real y la distribución por plan", async ({
  page,
}) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockAdminShell(page);

  await page.route("**/api/v1/admin/subscription-stats", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(SUBSCRIPTION_STATS),
    })
  );

  await page.goto("/admin");

  await expect(page.getByText("Suscripciones")).toBeVisible();
  await expect(page.getByText("Ingreso mensual recurrente")).toBeVisible();
  await expect(page.getByText("ARS 65.000")).toBeVisible();
  await expect(page.getByText("Cobro no activado")).toHaveCount(0);
  await expect(page.getByText("Potencial si se cobrara")).toHaveCount(0);
  await expect(page.getByText("Cerca del límite")).toBeVisible();
  await expect(page.getByText("Gratis: 2")).toBeVisible();
  await expect(page.getByText("Básico: 1")).toBeVisible();
  await expect(page.getByText("Pro: 1")).toBeVisible();
});

/**
 * F1 de la auditoría 2026-08-15: sin credenciales de Mercado Pago
 * (`billing_enabled: false`, el default real), el panel mostraba pesos
 * que nunca se cobraron como si fueran ingreso real. El número principal
 * ahora es $0, con el potencial como dato secundario, nunca al revés.
 */
test("sin el cobro activo, el MRR muestra $0 real y el potencial como dato secundario", async ({
  page,
}) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockAdminShell(page);

  await page.route("**/api/v1/admin/subscription-stats", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...SUBSCRIPTION_STATS, billing_enabled: false }),
    })
  );

  await page.goto("/admin");

  await expect(page.getByText("Cobro no activado")).toBeVisible();
  await expect(page.getByText("ARS 0")).toBeVisible();
  await expect(page.getByText("Potencial si se cobrara: ARS 65.000")).toBeVisible();
});
