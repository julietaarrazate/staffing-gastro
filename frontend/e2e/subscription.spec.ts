import { test, expect } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * Suscripción (ADR-0005, Fase 1 — mensualidad al comercio). Sin backend real:
 * todo `/api/v1/*` se mockea con page.route. Cubre las 3 pantallas clave del
 * entregable: la pantalla de planes con el actual marcado, el aviso de "casi
 * al límite" en el estado del plan, y el mensaje (no un error crudo) cuando
 * publicar un turno pega contra el límite del plan.
 */

const EMPLOYER_ME = {
  id: "user-2",
  email: "demo.palermo@staffya.com",
  full_name: "Comercio Demo",
  role: "employer",
  status: "activo",
  is_active: true,
  is_verified: true,
};

const PLANS = [
  {
    code: "gratis",
    name: "Gratis",
    price_ars: 0,
    max_turnos_mes: 5,
    features: ["Hasta 5 turnos por mes", "Chat con postulantes", "Soporte por email"],
  },
  {
    code: "basico",
    name: "Básico",
    price_ars: 20000,
    max_turnos_mes: 15,
    features: ["Hasta 15 turnos por mes", "Chat con postulantes", "Soporte prioritario"],
  },
  {
    code: "pro",
    name: "Pro",
    price_ars: 45000,
    max_turnos_mes: null,
    features: ["Turnos ilimitados", "Chat con postulantes", "Soporte prioritario", "Insignia destacada"],
  },
];

async function mockAuthAndSession(page: import("@playwright/test").Page) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(EMPLOYER_ME) })
  );
}

async function mockPlans(page: import("@playwright/test").Page) {
  await page.route("**/api/v1/subscription/plans", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ plans: PLANS }) })
  );
}

test("pantalla de planes: muestra las 3 tarjetas con el plan actual marcado", async ({ page }) => {
  await mockAuthAndSession(page);
  await mockPlans(page);
  await page.route("**/api/v1/subscription", (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        plan_code: "basico",
        status: "activa",
        period_end: "2026-08-01T00:00:00Z",
        price_ars: 20000,
        max_turnos_mes: 15,
        turnos_usados_mes: 3,
      }),
    });
  });

  await page.goto("/subscription");

  await expect(page.getByRole("heading", { name: "Mi plan" })).toBeVisible();
  await expect(page.getByText("3 de 15 turnos usados")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Planes disponibles" })).toBeVisible();
  await expect(page.getByText("Tu plan actual")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mejorá tu plan" })).toBeVisible();

  await page.screenshot({ path: "/tmp/sub-fe-plans.png", fullPage: true });
});

test("estado del plan: avisa cuando quedan pocos turnos, con CTA a mejorar", async ({ page }) => {
  await mockAuthAndSession(page);
  await mockPlans(page);
  await page.route("**/api/v1/subscription", (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        plan_code: "basico",
        status: "activa",
        period_end: "2026-08-01T00:00:00Z",
        price_ars: 20000,
        max_turnos_mes: 15,
        turnos_usados_mes: 13,
      }),
    });
  });

  await page.goto("/subscription");

  await expect(page.getByText("13 de 15 turnos usados")).toBeVisible();
  await expect(page.getByText("Te quedan 2 turnos este mes.")).toBeVisible();

  await page.screenshot({ path: "/tmp/sub-fe-near-limit.png", fullPage: true });
});

test("publicar turno al límite del plan: muestra el mensaje con CTA, no un error crudo", async ({ page }) => {
  await mockAuthAndSession(page);

  await page.route("**/api/v1/shifts", (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: "shift-new-1" }),
      });
    }
    return route.continue();
  });

  // El endpoint de publicar turno devuelve 402 con el mensaje del backend
  // cuando el comercio llegó al límite de turnos de su plan (contrato congelado).
  await page.route("**/api/v1/shifts/shift-new-1/publish", (route) =>
    route.fulfill({
      status: 402,
      contentType: "application/json",
      body: JSON.stringify({
        detail: "Llegaste al límite de 15 turnos de tu plan Básico este mes.",
      }),
    })
  );

  await page.route("**/api/v1/shifts/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  await page.goto("/shifts/new");

  await page.getByRole("button", { name: "Mozo/a" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.locator('input[type="datetime-local"]').first().fill("2026-07-15T20:00");
  await page.locator('input[type="datetime-local"]').nth(1).fill("2026-07-15T23:00");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByPlaceholder("48000").fill("15000");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.locator("select").nth(1).selectOption("Palermo");

  await page.getByRole("button", { name: "Publicar turno" }).click();

  await expect(page.getByText("Llegaste al límite de tu plan")).toBeVisible();
  await expect(page.getByText("Llegaste al límite de 15 turnos de tu plan Básico este mes.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mejorá tu plan" })).toBeVisible();
  // Sigue en /shifts/new: no navega hasta que el usuario elija qué hacer.
  await expect(page).toHaveURL("/shifts/new");

  await page.screenshot({ path: "/tmp/sub-fe-limit-reached.png", fullPage: true });
});
