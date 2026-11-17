import { test, expect, type Page } from "@playwright/test";
import {
  blockExternalHosts,
  injectSession,
  mockEmptyNotifications,
  skipSplash,
} from "./mocks";

/**
 * Etapa 3 de la beta, grupo M (admin): «Ver como» (U131), «Turnos en vivo»
 * con más turnos que el tope (U129), ficha de persona (U132, U134).
 */

const ADMIN = {
  id: "admin-1",
  email: "julietaarrazate@gmail.com",
  full_name: "Julieta Arrazate",
  role: "admin",
  status: "active",
  is_active: true,
  is_verified: true,
};

const WORKER_VIEW = {
  id: "test-worker-1",
  email: "prueba.trabajador@oido.beta",
  full_name: "Prueba · Trabajador con nombre largo",
  role: "worker",
  status: "active",
  is_active: true,
  is_verified: true,
};

const json = (body: unknown) => ({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify(body),
});

async function base(page: Page) {
  await skipSplash(page);
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) => route.fulfill(json(ADMIN)));
  await page.route("**/api/v1/shifts/feed", (route) => route.fulfill(json([])));
  await page.route("**/api/v1/workers/me/profile", (route) =>
    route.fulfill({ status: 404, contentType: "application/json", body: "{}" })
  );
  await page.route("**/api/v1/applications/mine", (route) => route.fulfill(json([])));
}

test("«Ver como»: el cartel muestra el nombre en un celular y sobrevive a recargar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await base(page);
  let impersonations = 0;
  await page.route("**/api/v1/admin/users/test-worker-1/impersonate", (route) => {
    impersonations += 1;
    return route.fulfill(json({ access_token: "e2e-impersonated-token", user: WORKER_VIEW }));
  });
  await page.route("**/api/v1/admin/test-accounts", (route) => route.fulfill(json([])));

  await page.goto("/");
  // Sin pantalla de herramientas mockeada completa: se dispara la marca como
  // lo hace `impersonate` y se recarga, que es lo que rompía.
  await page.evaluate(() => sessionStorage.setItem("staffya_impersonating", "test-worker-1"));
  await page.reload();

  const banner = page.getByRole("status").filter({ hasText: "Viendo como" });
  await expect(banner).toContainText("Prueba · Trabajador con nombre largo");
  const name = banner.locator("strong");
  await expect(name).toBeVisible();
  expect((await name.boundingBox())!.width).toBeGreaterThan(60);
  expect(impersonations).toBe(1);
});

test("«Ver como»: si la persona ya no se puede ver, vuelve limpio al panel de admin", async ({
  page,
}) => {
  await base(page);
  await page.route("**/api/v1/admin/users/test-worker-1/impersonate", (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Usuario no encontrado" }),
    })
  );
  await page.route("**/api/v1/admin/**", (route) => {
    if (route.request().url().includes("impersonate")) return route.fallback();
    return route.fulfill(json([]));
  });
  await page.goto("/");
  await page.evaluate(() => sessionStorage.setItem("staffya_impersonating", "test-worker-1"));
  await page.reload();
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByText("Permisos insuficientes")).toHaveCount(0);
  await expect(page.getByText("Viendo como")).toHaveCount(0);
});

function liveShift(i: number) {
  return {
    id: `s${i}`,
    title: `Turno ${i}`,
    position: "mozo",
    status: "buscando_personal",
    start_at: new Date(Date.now() + 3_600_000).toISOString(),
    end_at: new Date(Date.now() + 9 * 3_600_000).toISOString(),
    city: "Palermo",
    company_name: "Bodegón Don Pepe",
    urgent: false,
    escalated: false,
    escalated_at: null,
    published_at: new Date(Date.now() - 5 * 60_000).toISOString(),
    minutes_open: 5,
    applications: 0,
  };
}

test("«Turnos en vivo» avisa cuando hay más turnos de los que se muestran", async ({ page }) => {
  await base(page);
  await page.route("**/api/v1/admin/live-shifts**", (route) =>
    route.fulfill(
      json({
        generated_at: new Date().toISOString(),
        total: 253,
        urgent: 4,
        escalated: 1,
        no_shows: 0,
        shown_live: 200,
        limit: 200,
        shifts: [liveShift(1), liveShift(2)],
      })
    )
  );
  await page.goto("/admin/en-vivo");
  await expect(page.getByText("Mostrando 200 de 253 turnos en vivo")).toBeVisible();
  await expect(page.getByRole("button", { name: /Todos \(253\)/ })).toBeVisible();
});

test("«Turnos en vivo» no avisa nada si entran todos", async ({ page }) => {
  await base(page);
  await page.route("**/api/v1/admin/live-shifts**", (route) =>
    route.fulfill(
      json({
        generated_at: new Date().toISOString(),
        total: 1,
        urgent: 0,
        escalated: 0,
        no_shows: 0,
        shown_live: 1,
        limit: 200,
        shifts: [liveShift(1)],
      })
    )
  );
  await page.goto("/admin/en-vivo");
  await expect(page.getByText("Turno 1")).toBeVisible();
  await expect(page.getByText(/Mostrando \d+ de/)).toHaveCount(0);
});

test("ficha de persona: nombre y mail largos se leen completos y se ve el turno donde faltó", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await base(page);
  const email = "ana.maria.fernandez.de.la.vega.gutierrez@restaurante-del-centro.com.ar";
  await page.route("**/api/v1/admin/users/u-ana", (route) =>
    route.fulfill(
      json({
        user: {
          id: "u-ana",
          email,
          full_name: "Ana María Fernández de la Vega Gutiérrez",
          role: "worker",
          status: "active",
          is_verified: true,
          created_at: "2026-08-01T12:00:00Z",
          photo_url: null,
        },
        worker: {
          city: "Palermo",
          skills: ["mozo"],
          years_experience: 3,
          is_available: true,
          rating: null,
          events_completed: 0,
          punctuality_rate: 0,
          cancellations: 0,
          no_shows: 1,
          level: "bronce",
        },
        company: null,
        recent_shifts: [
          {
            id: "s1",
            title: "Mozo para cena",
            position: "mozo",
            start_at: "2026-10-18T23:00:00Z",
            status: "publicado",
            pay_amount: "25000.00",
            absent: true,
          },
        ],
        tickets: [],
      })
    )
  );
  await page.goto("/admin/personas/u-ana");
  await expect(page.getByText(email)).toBeVisible();
  const emailBox = await page.getByText(email).boundingBox();
  expect(emailBox!.x + emailBox!.width).toBeLessThanOrEqual(390);
  await expect(page.getByRole("heading", { name: /Fernández de la Vega Gutiérrez/ })).toBeVisible();
  await expect(page.getByText("Todavía no tiene turnos")).toHaveCount(0);
  await expect(page.getByText("Mozo para cena")).toBeVisible();
  await expect(page.getByText("No se presentó", { exact: true }).first()).toBeVisible();
});
