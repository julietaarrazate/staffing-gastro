import { test, expect } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * Cuentas de prueba en el panel de admin (pedido de Julieta: poder testear
 * la app como trabajador/comercio con su mismo mail de admin). El panel
 * pide `GET /admin/test-accounts` (get-or-create en el backend) y muestra
 * un botón "Ver como" por cuenta que reutiliza el flujo de impersonación
 * ya existente (`useAuth().impersonate`).
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
  total_users: 3,
  workers: 1,
  employers: 1,
  admins: 1,
  active: 3,
  suspended: 0,
  verified: 2,
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

const TEST_ACCOUNTS = [
  {
    id: "test-worker-1",
    email: "prueba.trabajador@oido.beta",
    full_name: "Prueba · Trabajador",
    role: "worker",
  },
  {
    id: "test-employer-1",
    email: "prueba.comercio@oido.beta",
    full_name: "Prueba · Comercio",
    role: "employer",
  },
];

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
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(TEST_ACCOUNTS) })
  );
  await page.route("**/api/v1/identity/claims/pending", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
}

test("el panel de admin muestra las cuentas de prueba con acceso directo", async ({ page }) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockAdminPanel(page);

  await page.goto("/admin");

  await expect(page.getByText("Mis cuentas de prueba")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ver como trabajador" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ver como comercio" })).toBeVisible();
});

test("\"Ver como trabajador\" (cuenta de prueba) impersona y saca del panel de admin", async ({
  page,
}) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockAdminPanel(page);

  let impersonatedId: string | null = null;
  await page.route("**/api/v1/admin/users/test-worker-1/impersonate", (route) => {
    impersonatedId = "test-worker-1";
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "e2e-impersonated-token",
        token_type: "bearer",
        user: {
          id: "test-worker-1",
          email: "prueba.trabajador@oido.beta",
          full_name: "Prueba · Trabajador",
          role: "worker",
          status: "active",
          is_active: true,
          is_verified: true,
        },
      }),
    });
  });
  // Home del trabajador tras la impersonación (`router.push("/")` -> /feed).
  await page.route("**/api/v1/shifts/feed", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/v1/workers/me/profile", (route) =>
    route.fulfill({ status: 404, contentType: "application/json", body: "{}" })
  );
  await page.route("**/api/v1/applications/mine", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  await page.goto("/admin");
  await page.getByRole("button", { name: "Ver como trabajador" }).click();

  await expect(page).toHaveURL(/\/feed$/);
  await expect.poll(() => impersonatedId).toBe("test-worker-1");
});
