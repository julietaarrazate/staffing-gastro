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
    code: "inicial",
    name: "Inicial",
    price_ars: 9900,
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

// --- Cobro mensual con Mercado Pago (ADR-0022) ---------------------------

function mockSubscription(page: import("@playwright/test").Page, body: Record<string, unknown>) {
  return page.route("**/api/v1/subscription", (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

const PENDING_SUB = {
  plan_code: "inicial",
  status: "pendiente",
  period_end: "2026-11-22T00:00:00Z",
  price_ars: 9900,
  max_turnos_mes: 5,
  turnos_usados_mes: 0,
  billing_enabled: true,
  paid_until: null,
  renews: true,
  can_publish: false,
  withdrawal_until: null,
};

const PAID_SUB = {
  ...PENDING_SUB,
  plan_code: "basico",
  status: "activa",
  price_ars: 20000,
  max_turnos_mes: 15,
  turnos_usados_mes: 2,
  paid_until: "2099-11-22T15:00:00Z",
  can_publish: true,
  withdrawal_until: "2099-11-02",
};

test("cobro prendido, comercio sin pagar: pide el primer mes y lleva a Mercado Pago", async ({ page }) => {
  await mockAuthAndSession(page);
  await mockPlans(page);
  await mockSubscription(page, PENDING_SUB);
  let subscribeBody: unknown = null;
  await page.route("**/api/v1/subscription/subscribe", (route) => {
    subscribeBody = route.request().postDataJSON();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        plan_code: "inicial",
        status: "pendiente",
        checkout_url: "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=test",
      }),
    });
  });
  await page.route("https://www.mercadopago.com.ar/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Checkout de prueba</h1>" })
  );

  await page.goto("/subscription");

  await expect(page.getByText("Falta pagar")).toBeVisible();
  await expect(page.getByText("Para publicar turnos, pagá tu primer mes.")).toBeVisible();
  await page.getByRole("button", { name: "Pagar el mes" }).first().click();

  await expect(page.getByRole("heading", { name: "Pagá con Mercado Pago" })).toBeVisible();
  await expect(page.getByText("dinero en cuenta, débito o transferencia")).toBeVisible();
  await page.getByRole("button", { name: "Ir a Mercado Pago" }).click();

  await expect(page).toHaveURL(/mercadopago\.com\.ar\/checkout/);
  expect(subscribeBody).toEqual({ plan_code: "inicial" });
});

for (const [pago, text] of [
  ["ok", "¡Listo! Recibimos tu pago"],
  ["pendiente", "Tu pago quedó pendiente"],
  ["error", "El pago no se completó"],
] as const) {
  test(`vuelta de Mercado Pago (?pago=${pago}): mensaje claro`, async ({ page }) => {
    await mockAuthAndSession(page);
    await mockPlans(page);
    await mockSubscription(page, pago === "ok" ? PAID_SUB : PENDING_SUB);

    await page.goto(`/subscription?pago=${pago}`);

    await expect(page.getByRole("status").filter({ hasText: text })).toBeVisible();
  });
}

test("plan pago: muestra hasta cuándo, permite renovar, dar de baja y arrepentirse", async ({ page }) => {
  await mockAuthAndSession(page);
  await mockPlans(page);
  await mockSubscription(page, PAID_SUB);
  let cancelled = false;
  await page.route("**/api/v1/subscription/cancel-renewal", (route) => {
    cancelled = true;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...PAID_SUB, renews: false }),
    });
  });

  await page.goto("/subscription");

  await expect(page.getByText(/Pagado hasta el/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Pagar 30 días más" })).toBeVisible();
  await expect(page.getByText("Tenés hasta el 2/11/2099 para arrepentirte")).toBeVisible();
  await expect(page.getByRole("button", { name: "Arrepentirme" })).toBeVisible();

  await page.getByRole("button", { name: "Dar de baja" }).click();
  await expect(page.getByRole("heading", { name: "¿Dar de baja tu plan?" })).toBeVisible();
  await page.getByRole("button", { name: "Sí, dar de baja" }).click();

  expect(cancelled).toBe(true);
  await expect(page.getByText("No se renueva", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "¿Dar de baja tu plan?" })).toHaveCount(0);
  await expect(page.getByText(/^Activo hasta el .*Después no se renueva\.$/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Dar de baja" })).toHaveCount(0);
});

test("arrepentimiento: confirma y deja el plan cancelado", async ({ page }) => {
  await mockAuthAndSession(page);
  await mockPlans(page);
  await mockSubscription(page, PAID_SUB);
  await page.route("**/api/v1/subscription/withdraw", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...PAID_SUB,
        status: "cancelada",
        renews: false,
        can_publish: false,
        paid_until: "2026-10-23T12:00:00Z",
        withdrawal_until: null,
      }),
    })
  );

  await page.goto("/subscription");
  await page.getByRole("button", { name: "Arrepentirme" }).click();
  await expect(page.getByRole("heading", { name: "¿Te arrepentís del plan?" })).toBeVisible();
  await page.getByRole("button", { name: "Sí, quiero la devolución" }).click();

  await expect(page.getByText("Cancelado", { exact: true })).toBeVisible();
  await expect(page.getByText("Tu plan está cancelado. Pagá un mes para volver a publicar turnos.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Arrepentirme" })).toHaveCount(0);
});

test("cobro apagado: la pantalla sigue como en la beta (sin baja ni pagos)", async ({ page }) => {
  await mockAuthAndSession(page);
  await mockPlans(page);
  await mockSubscription(page, {
    plan_code: "inicial",
    status: "activa",
    period_end: "2026-11-22T00:00:00Z",
    price_ars: 9900,
    max_turnos_mes: 5,
    turnos_usados_mes: 1,
    billing_enabled: false,
    paid_until: null,
    renews: true,
    can_publish: true,
    withdrawal_until: null,
  });

  await page.goto("/subscription");

  await expect(page.getByText("1 de 5 turnos usados")).toBeVisible();
  await expect(page.getByRole("button", { name: "Plan actual" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Dar de baja" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Pagar el mes" })).toHaveCount(0);
});

test("publicar sin plan pago: modal propio con CTA a pagar", async ({ page }) => {
  await mockAuthAndSession(page);
  await page.route("**/api/v1/shifts", (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: "shift-new-2" }) });
    }
    return route.continue();
  });
  await page.route("**/api/v1/shifts/shift-new-2/publish", (route) =>
    route.fulfill({
      status: 402,
      contentType: "application/json",
      body: JSON.stringify({
        detail: "Tu plan no está activo. Pagá el mes desde Mi plan para volver a publicar turnos.",
      }),
    })
  );
  await page.route("**/api/v1/shifts/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  await page.goto("/shifts/new");
  await page.getByRole("button", { name: "Mozo/a" }).click();
  await page.locator('input[type="datetime-local"]').first().fill("2026-07-15T20:00");
  await page.locator('input[type="datetime-local"]').nth(1).fill("2026-07-15T23:00");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByPlaceholder("48000").fill("15000");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.locator("select").nth(1).selectOption("Palermo");
  await page.getByRole("button", { name: "Publicar turno" }).click();

  await expect(page.getByText("Activá tu plan para publicar")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ir a pagar el mes" })).toBeVisible();
});
