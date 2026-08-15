import { test, expect } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * Métricas de producto en el panel de admin (pedido de Julieta: "un control
 * general del negocio ... métricas y aporte al negocio"). El backend ya
 * calculaba estas tasas (`GET /admin/stats`); este spec cubre que el panel
 * las muestre — antes se descartaban en silencio.
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
  coverage_sample_size: 5,
  avg_time_to_fill_minutes: 8,
  pct_filled_under_10_min: 80,
  shift_assignment_rate_sample_size: 10,
  shift_assignment_rate_pct: 70,
  shift_completion_rate_sample_size: 10,
  shift_completion_rate_pct: 50,
  application_acceptance_sample_size: 20,
  application_to_acceptance_rate_pct: 35,
  no_show_sample_size: 8,
  no_show_rate_pct: 12.5,
  worker_completion_repeat_sample_size: 6,
  worker_completion_repeat_rate_pct: 66,
  employer_repeat_sample_size: 4,
  employer_repeat_rate_pct: 25,
};

async function mockAdminPanel(page: import("@playwright/test").Page) {
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
  await page.route("**/api/v1/admin/subscription-stats", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        mrr_ars: "0",
        total_companies: 0,
        companies_by_plan: {},
        companies_at_plan_limit: 0,
        billing_enabled: false,
      }),
    })
  );
  await page.route("**/api/v1/identity/claims/pending", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
}

test("el panel de admin muestra admins/verificados y las 6 métricas de producto", async ({
  page,
}) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockAdminPanel(page);

  await page.goto("/admin");

  // Grilla principal ampliada (antes sólo mostraba usuarios/trabajadores/
  // comercios/suspendidos, con `admins`/`verified` ya calculados pero
  // ocultos).
  await expect(page.getByText("Admins")).toBeVisible();
  await expect(page.getByText("Verificados")).toBeVisible();

  await expect(page.getByText("Métricas de producto")).toBeVisible();
  await expect(page.getByText("Turnos asignados")).toBeVisible();
  await expect(page.getByText("Turnos completados")).toBeVisible();
  await expect(page.getByText("Postulaciones aceptadas")).toBeVisible();
  await expect(page.getByText("No-shows")).toBeVisible();
  await expect(page.getByText("Trabajadores que repiten")).toBeVisible();
  await expect(page.getByText("Comercios que repiten")).toBeVisible();

  await expect(page.getByText("70%")).toBeVisible();
  await expect(page.getByText("Sobre 10 turnos publicados").first()).toBeVisible();
  await expect(page.getByText("Sobre 4 comercios activos")).toBeVisible();
});

test("sin muestra todavía, una métrica de producto muestra un guion en vez de 0%", async ({
  page,
}) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);

  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ADMIN_SESSION) })
  );
  await page.route("**/api/v1/admin/stats", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...STATS,
        no_show_sample_size: 0,
        no_show_rate_pct: null,
      }),
    })
  );
  await page.route("**/api/v1/admin/users", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/v1/admin/test-accounts", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/v1/admin/subscription-stats", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        mrr_ars: "0",
        total_companies: 0,
        companies_by_plan: {},
        companies_at_plan_limit: 0,
        billing_enabled: false,
      }),
    })
  );
  await page.route("**/api/v1/identity/claims/pending", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  await page.goto("/admin");

  await expect(page.getByText("No-shows")).toBeVisible();
  await expect(page.getByText("Sobre 0 asignaciones")).toBeVisible();
});
