import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * El plan elegido en los precios de la landing llega a "Mi plan" (pedido de
 * Julieta, 2026-10-30, `lib/plan-elegido.ts`): "Empezar con Básico" → alta de
 * comercio con `?plan=basico` → onboarding de `/bienvenida` → `/subscription
 * ?plan=basico` con la tarjeta resaltada y el aviso arriba, en vez del panel.
 * Toda la API mockeada.
 */

const PLANS = [
  { code: "inicial", name: "Inicial", price_ars: 9900, max_turnos_mes: 5, features: ["Hasta 5 turnos publicados por mes", "Soporte por email"] },
  { code: "basico", name: "Básico", price_ars: 20000, max_turnos_mes: 15, features: ["Hasta 15 turnos publicados por mes", "Soporte prioritario"] },
  { code: "pro", name: "Pro", price_ars: 45000, max_turnos_mes: null, features: ["Turnos publicados ilimitados", "Soporte prioritario", "Destacado en el feed"] },
];

const EMPLOYER = {
  id: "user-9",
  email: "nuevo.bodegon@staffya.com",
  full_name: "Dueña Nueva",
  role: "employer",
  status: "activo",
  is_active: true,
  is_verified: true,
};

/** Un comercio recién creado: plan Inicial (el de arranque), sin usar. */
const SUB_INICIAL = {
  plan_code: "inicial",
  status: "activa",
  period_end: "2026-12-01T00:00:00Z",
  price_ars: 9900,
  max_turnos_mes: 5,
  turnos_usados_mes: 0,
};

function json(body: unknown, status = 200) {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

/** La API de "Mi plan" con el cobro apagado; devuelve lo que se mandó a suscribir. */
async function mockMiPlan(page: Page, sub: Record<string, unknown> = SUB_INICIAL) {
  const suscripciones: unknown[] = [];
  let actual = sub;
  await page.route("**/api/v1/subscription", (route) =>
    route.request().method() === "GET" ? route.fulfill(json(actual)) : route.continue()
  );
  await page.route("**/api/v1/subscription/plans", (route) => route.fulfill(json({ plans: PLANS })));
  await page.route("**/api/v1/subscription/subscribe", (route) => {
    const body = route.request().postDataJSON() as { plan_code: string };
    suscripciones.push(body);
    const plan = PLANS.find((p) => p.code === body.plan_code)!;
    actual = { ...actual, plan_code: plan.code, price_ars: plan.price_ars, max_turnos_mes: plan.max_turnos_mes };
    return route.fulfill(json({ plan_code: plan.code, status: "activa", checkout_url: null }));
  });
  return suscripciones;
}

async function comercioConSesion(page: Page) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) => route.fulfill(json(EMPLOYER)));
}

test("Empezar con Básico: alta, bienvenida y Mi plan con Básico resaltado", async ({ page }) => {
  await skipSplash(page);
  await blockExternalHosts(page);
  // Catch-all primero: Playwright resuelve las rutas al revés (gana la última).
  await page.route("**/api/v1/**", (route) => route.fulfill(json({}, 404)));
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/subscription/plans/public", (route) => route.fulfill(json({ plans: PLANS })));
  let alta: Record<string, unknown> | null = null;
  await page.route("**/api/v1/auth/register", (route) => {
    alta = route.request().postDataJSON();
    return route.fulfill(json(EMPLOYER, 201));
  });
  await page.route("**/api/v1/auth/login", (route) =>
    route.fulfill(json({ access_token: "e2e-access-token", token_type: "bearer" }))
  );
  await page.route("**/api/v1/auth/me", (route) => route.fulfill(json(EMPLOYER)));
  await page.route("**/api/v1/companies/me/profile", (route) =>
    route.request().method() === "POST"
      ? route.fulfill(json({ id: "company-9", user_id: "user-9", name: "Mi comercio" }, 201))
      : route.continue()
  );
  const suscripciones = await mockMiPlan(page);

  // 1. Landing: el botón del Básico lleva al alta de comercio con el plan.
  await page.goto("/#precios");
  const empezar = page.locator("#precios").getByRole("link", { name: "Empezar con Básico" });
  await expect(empezar).toHaveAttribute("href", "/register?rol=comercio&plan=basico");
  await empezar.click();

  // 2. Alta: ya viene marcado "Soy comercio".
  await expect(page).toHaveURL(/\/register\?rol=comercio&plan=basico$/);
  await expect(page.getByRole("button", { name: "Soy comercio" })).toHaveAttribute("aria-pressed", "true");
  await page.getByPlaceholder("Nombre completo").fill("Dueña Nueva");
  await page.getByPlaceholder("Email").fill("nuevo.bodegon@staffya.com");
  await page.getByPlaceholder("Contraseña (mín. 8 caracteres)").fill("unaClaveLarga1");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  // 3. Bienvenida: la salida más corta ("Omitir por ahora") ya alcanza.
  await page.waitForURL("**/bienvenida");
  expect(alta).toMatchObject({ role: "employer" });
  await page.getByRole("button", { name: "Omitir por ahora" }).click();

  // 4. Mi plan, no el panel: aviso arriba y la tarjeta del Básico con el foco.
  await page.waitForURL("**/subscription?plan=basico");
  const aviso = page.getByTestId("plan-elegido");
  await expect(aviso).toContainText("Elegiste el plan Básico");
  await expect(aviso).toContainText("$20.000/mes, hasta 15 turnos por mes.");
  const elegida = page.locator('[data-plan-elegido="basico"]');
  await expect(elegida).toBeFocused();
  await expect(elegida).toContainText("Básico");
  // Lo guardado se borró: otra vuelta por la bienvenida ya no viene acá.
  expect(await page.evaluate(() => sessionStorage.getItem("staffya_plan_elegido"))).toBeNull();
  // Un solo ámbar: el botón del aviso. Las tarjetas, sin acento.
  await expect(page.getByRole("button", { name: "Mejorá tu plan" })).toHaveCount(2);
  for (const boton of await page.getByRole("button", { name: "Mejorá tu plan" }).all()) {
    await expect(boton).not.toHaveClass(/bg-primary/);
  }

  // 5. La acción del aviso es la de siempre (cobro apagado: cambio inmediato).
  await aviso.getByRole("button", { name: "Activar este plan" }).click();
  await expect(page.getByRole("dialog")).toContainText("¿Confirmás el cambio al plan Básico");
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(aviso).toContainText("Ya es tu plan.");
  await expect(aviso.getByRole("button")).toHaveCount(0);
  expect(suscripciones).toEqual([{ plan_code: "basico" }]);
});

test("las tres tarjetas de precios tienen su botón alineado abajo", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await skipSplash(page);
  await blockExternalHosts(page);
  await page.route("**/api/v1/**", (route) => route.fulfill(json({}, 404)));
  await page.goto("/#precios");
  const botones = page.locator("#precios").getByRole("link", { name: /^Empezar con / });
  await expect(botones).toHaveCount(3);
  const cajas = await botones.evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      const tarjeta = el.closest("li")!.getBoundingClientRect();
      return { arriba: Math.round(r.top), ancho: Math.round(r.width), anchoUtil: Math.round(tarjeta.width - 48) };
    })
  );
  // Misma altura en las tres, aunque cada plan sume distinto; ancho completo.
  expect(new Set(cajas.map((c) => c.arriba)).size).toBe(1);
  for (const c of cajas) expect(c.ancho).toBe(c.anchoUtil);
  // Sin ámbar: ninguno de los tres va en el color de la acción de la app.
  const fondos = await botones.evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));
  expect(fondos).not.toContain("rgb(217, 119, 6)");
});

test("con un plan que no existe, Mi plan queda como siempre", async ({ page }) => {
  await comercioConSesion(page);
  await mockMiPlan(page);
  await page.goto("/subscription?plan=gratis");
  await expect(page.getByRole("heading", { name: "Planes disponibles" })).toBeVisible();
  await expect(page.getByTestId("plan-elegido")).toHaveCount(0);
  await expect(page.locator("[data-plan-elegido]")).toHaveCount(0);
  // El ámbar de siempre en "Mejorá tu plan".
  await expect(page.getByRole("button", { name: "Mejorá tu plan" }).first()).toHaveClass(/bg-primary/);
});

test("con el cobro prendido, el aviso lleva a pagar el plan elegido con Mercado Pago", async ({ page }) => {
  await comercioConSesion(page);
  await mockMiPlan(page, {
    ...SUB_INICIAL,
    status: "pendiente",
    billing_enabled: true,
    paid_until: null,
    renews: true,
    can_publish: false,
  });
  await page.goto("/subscription?plan=pro");
  const aviso = page.getByTestId("plan-elegido");
  await expect(aviso).toContainText("Elegiste el plan Pro");
  await expect(page.locator('[data-plan-elegido="pro"]')).toBeFocused();
  // El aviso "pagá tu primer mes" del estado pagaría el Inicial: con el aviso
  // del plan elegido arriba, se esconde.
  await expect(page.getByText("Para publicar turnos, pagá tu primer mes.")).toHaveCount(0);
  await aviso.getByRole("button", { name: "Pagar con Mercado Pago" }).click();
  await expect(page.getByRole("dialog")).toContainText("del plan Pro");
  await expect(page.getByRole("button", { name: "Ir a Mercado Pago" })).toBeVisible();
});
