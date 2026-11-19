import { test, expect, type Page } from "@playwright/test";
import {
  blockExternalHosts,
  injectSession,
  mockEmptyNotifications,
  setTheme,
  skipSplash,
} from "./mocks";

/**
 * Medición de la beta, M6: el bloque «Plan» de la ficha de un comercio
 * (plan actual, plan elegido al darse de alta y compromiso de pago que
 * registra la admin) y los números nuevos de `/admin/metricas`.
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

const PEPE = {
  id: "u-pepe",
  email: "pepe@bodegon.com",
  full_name: "Pepe Bodegón",
  role: "employer",
  status: "active",
  is_verified: true,
  created_at: "2026-08-15T12:00:00Z",
  photo_url: null,
};

const SIN_COMPROMISO = {
  plan_code: "inicial",
  plan_name: "Inicial",
  chosen_plan_code: "basico",
  chosen_plan_name: "Básico",
  chosen_plan_at: "2026-11-10T15:00:00Z",
  commitment: null,
};

const CON_COMPROMISO = {
  ...SIN_COMPROMISO,
  commitment: { at: "2026-11-17T15:00:00Z", plan_code: "basico", plan_name: "Básico", price_ars: "15000.00" },
};

const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

function detail(subscription: unknown) {
  return {
    user: PEPE,
    worker: null,
    company: {
      name: "Bodegón Don Pepe",
      category: "bar",
      address: "Honduras 5000",
      city: "Palermo",
      rating: 4.5,
      events_published: 6,
      on_time_payment_rate: 1,
      payments_recorded: 4,
      late_cancellations: 0,
    },
    recent_shifts: [],
    tickets: [],
    subscription,
  };
}

async function setup(page: Page, estado: { sub: unknown }, llamadas: { metodo: string; body: unknown }[]) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) => route.fulfill(json(ADMIN_SESSION)));
  await page.route("**/api/v1/identity/claims/pending", (route) => route.fulfill(json([])));
  await page.route("**/api/v1/support/tickets?**", (route) => route.fulfill(json([])));
  await page.route("**/api/v1/admin/leads/summary**", (route) =>
    route.fulfill(json({ counts: { nuevo: 0 }, total: 0 }))
  );
  await page.route("**/api/v1/admin/users/u-pepe", (route) => route.fulfill(json(detail(estado.sub))));
  await page.route("**/api/v1/admin/users/u-pepe/payment-commitment", (route) => {
    const req = route.request();
    llamadas.push({ metodo: req.method(), body: req.postDataJSON() });
    estado.sub = req.method() === "PUT" ? CON_COMPROMISO : SIN_COMPROMISO;
    return route.fulfill(json(estado.sub));
  });
}

test("la ficha de un comercio muestra el plan y registra el compromiso de pago", async ({ page }) => {
  const llamadas: { metodo: string; body: unknown }[] = [];
  const estado = { sub: SIN_COMPROMISO as unknown };
  await setup(page, estado, llamadas);
  await page.goto("/admin/personas/u-pepe");

  const bloque = page.getByTestId("plan-compromiso");
  await expect(bloque).toContainText("Plan actual");
  await expect(bloque).toContainText("Inicial");
  await expect(bloque).toContainText("Eligió Básico al darse de alta (10/11)");
  await expect(bloque).toContainText("Todavía no se comprometió.");

  const registrar = bloque.getByRole("button", { name: "Registrar compromiso" });
  await expect(registrar).toBeDisabled();
  await bloque.getByLabel("Plan del compromiso").selectOption("basico");
  await bloque.getByLabel("Precio mensual acordado").fill("15000");
  await expect(registrar).toBeEnabled();
  await registrar.click();

  await expect(bloque).toContainText("Se comprometió el 17/11 a pagar Básico a $15.000/mes");
  expect(llamadas).toEqual([{ metodo: "PUT", body: { plan_code: "basico", price_ars: 15000 } }]);
  // El formulario desaparece: queda «Borrar».
  await expect(bloque.getByRole("button", { name: "Registrar compromiso" })).toHaveCount(0);
});

test("borrar el compromiso pide confirmación", async ({ page }) => {
  const llamadas: { metodo: string; body: unknown }[] = [];
  const estado = { sub: CON_COMPROMISO as unknown };
  await setup(page, estado, llamadas);
  await page.goto("/admin/personas/u-pepe");

  const bloque = page.getByTestId("plan-compromiso");
  await expect(bloque).toContainText("Se comprometió el 17/11 a pagar Básico a $15.000/mes");
  await bloque.getByRole("button", { name: "Borrar" }).click();
  await expect(page.getByText("¿Borrar el compromiso de pago?")).toBeVisible();
  await page.getByRole("button", { name: "Volver" }).click();
  expect(llamadas).toEqual([]);

  await bloque.getByRole("button", { name: "Borrar" }).click();
  await page.getByRole("button", { name: "Sí, borrar" }).click();
  await expect(bloque).toContainText("Todavía no se comprometió.");
  expect(llamadas.map((l) => l.metodo)).toEqual(["DELETE"]);
});

test("la ficha de un trabajador no tiene el bloque Plan", async ({ page }) => {
  await setup(page, { sub: SIN_COMPROMISO }, []);
  await page.route("**/api/v1/admin/users/u-ana", (route) =>
    route.fulfill(
      json({
        user: { ...PEPE, id: "u-ana", full_name: "Ana Mozo", role: "worker" },
        worker: null,
        company: null,
        recent_shifts: [],
        tickets: [],
      })
    )
  );
  await page.goto("/admin/personas/u-ana");
  await expect(page.getByRole("heading", { name: "Ana Mozo" })).toBeVisible();
  await expect(page.getByTestId("plan-compromiso")).toHaveCount(0);
});

test("Métricas muestra quiénes eligieron un plan y quiénes se comprometieron", async ({ page }) => {
  await setup(page, { sub: SIN_COMPROMISO }, []);
  await page.route("**/api/v1/admin/stats", (route) =>
    route.fulfill(
      json({
        total_users: 0, workers: 0, employers: 0, admins: 0, active: 0, suspended: 0, verified: 0,
        coverage_sample_size: 0, avg_time_to_fill_minutes: null, pct_filled_under_10_min: null,
        shift_assignment_rate_sample_size: 0, shift_assignment_rate_pct: null,
        shift_completion_rate_sample_size: 0, shift_completion_rate_pct: null,
        application_acceptance_sample_size: 0, application_to_acceptance_rate_pct: null,
        no_show_sample_size: 0, no_show_rate_pct: null,
        worker_completion_repeat_sample_size: 0, worker_completion_repeat_rate_pct: null,
        employer_return_30d_sample_size: 0, employer_return_30d_rate_pct: null,
      })
    )
  );
  await page.route("**/api/v1/admin/subscription-stats", (route) =>
    route.fulfill(
      json({
        mrr_ars: "29900",
        total_companies: 5,
        companies_by_plan: { inicial: 3, basico: 2 },
        companies_at_plan_limit: 0,
        companies_with_chosen_plan: { basico: 2, pro: 1 },
        committed_companies: 2,
        committed_mrr_ars: "35000",
        billing_enabled: false,
      })
    )
  );
  await page.goto("/admin/metricas");
  const eligieron = page.getByTestId("eligieron-plan");
  await expect(eligieron).toContainText("Eligieron un plan al darse de alta");
  await expect(eligieron).toContainText("3");
  await expect(eligieron).toContainText("Básico: 2");
  await expect(eligieron).toContainText("Pro: 1");
  const comprometieron = page.getByTestId("se-comprometieron");
  await expect(comprometieron).toContainText("Se comprometieron a pagar");
  await expect(comprometieron).toContainText("2");
  await expect(comprometieron).toContainText("$35.000/mes");
});
