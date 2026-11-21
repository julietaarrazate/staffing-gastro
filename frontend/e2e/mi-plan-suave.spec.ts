import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";
import { deContrato } from "./contrato";

/**
 * Mi plan con la dirección suave (ADR-0028, 2026-11-21,
 * docs/historial/2026-11-21-mi-plan-direccion-suave.md; sin maqueta): el cielo
 * corto con el título y la vuelta al perfil, la hoja con el plan actual, los
 * planes y la baja como tarjetas suaves, y **un solo botón ámbar**. Los
 * textos, los precios y las acciones son los de antes. Renderizado, en claro
 * y de noche.
 */
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

async function miPlan(page: Page, caso: "suscripcion_comercio" | "suscripcion_cobro_pendiente", extra: Record<string, unknown> = {}, tema: "light" | "dark" = "light") {
  await setTheme(page, tema);
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  // Catch-all primero: Playwright resuelve la última ruta registrada.
  await page.route("**/api/v1/**", (r) => (r.request().method() === "GET" ? r.fulfill(json([])) : r.continue()));
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json(deContrato("auth_me_employer"))));
  await page.route("**/api/v1/subscription", (r) => r.fulfill(json(deContrato(caso, extra))));
  await page.route("**/api/v1/subscription/plans", (r) => r.fulfill(json(deContrato("planes"))));
  await page.goto("/subscription");
  await expect(page.locator("html")).toHaveAttribute("data-theme", tema);
  await expect(page.getByRole("heading", { level: 2, name: "Planes disponibles" })).toBeVisible();
}

/** Los botones y links a la vista con el degradé ámbar del botón principal. */
const ambares = (page: Page) =>
  page.locator("main a, main button").evaluateAll((els) =>
    els
      .filter((el) => getComputedStyle(el).backgroundImage.includes("rgb(246, 169, 42)") && !(el as HTMLButtonElement).disabled)
      .map((el) => (el.textContent ?? "").trim())
  );

for (const tema of ["light", "dark"] as const) {
  test(`${tema}: el cielo con el título y la vuelta, y los planes como tarjetas suaves sobre la hoja`, async ({ page }) => {
    await miPlan(page, "suscripcion_comercio", {}, tema);
    const cielo = page.locator(".app-cielo");
    await expect(cielo.getByRole("heading", { level: 1 })).toHaveText("Mi plan");
    await expect(cielo.getByRole("link", { name: "Volver al perfil" })).toHaveAttribute("href", "/profile");
    await expect(cielo).toContainText("Gestioná la suscripción de tu comercio a Oído.");
    // Tarjetas sin filete: el borde lo da la sombra difusa.
    const tarjetas = page.locator(".hoja .tarjeta-suave");
    expect(await tarjetas.count()).toBeGreaterThanOrEqual(4);
    for (const sombra of await tarjetas.evaluateAll((els) => els.map((el) => getComputedStyle(el).boxShadow))) {
      expect(sombra).not.toBe("none");
      // Sin el anillo de 1 px de la tarjeta de antes.
      expect(sombra).not.toMatch(/0px 0px 0px 1px/);
    }
    // Los precios y los nombres, los de siempre.
    for (const texto of ["Inicial", "Básico", "Pro", "$9.900", "$20.000", "$45.000"]) {
      await expect(page.locator(".hoja")).toContainText(texto);
    }
  });
}

test("en la beta, un solo ámbar: el plan siguiente al actual; los demás, quietos", async ({ page }) => {
  await miPlan(page, "suscripcion_comercio");
  expect(await ambares(page)).toEqual(["Mejorá tu plan"]);
  // El ámbar es el de Básico (el siguiente a Inicial), no el de Pro.
  const basico = page.locator(".tarjeta-suave", { has: page.getByRole("heading", { name: "Básico" }) });
  const pro = page.locator(".tarjeta-suave", { has: page.getByRole("heading", { name: "Pro" }) });
  const fondo = (el: Element) => getComputedStyle(el).backgroundImage;
  expect(await basico.getByRole("button", { name: "Mejorá tu plan" }).evaluate(fondo)).toContain("rgb(246, 169, 42)");
  expect(await pro.getByRole("button", { name: "Mejorá tu plan" }).evaluate(fondo)).not.toContain("rgb(246, 169, 42)");
  // Pro se sigue pudiendo elegir.
  await expect(pro.getByRole("button", { name: "Mejorá tu plan" })).toBeEnabled();
});

test("con el cobro prendido y falta pagar, el único ámbar es «Pagar el mes» de arriba", async ({ page }) => {
  await miPlan(page, "suscripcion_cobro_pendiente");
  expect(await ambares(page)).toEqual(["Pagar el mes"]);
  // Los planes superiores siguen ahí, sin acento.
  await expect(page.getByRole("button", { name: "Mejorá tu plan" })).toHaveCount(2);
});

test("al llegar al límite del plan, el ámbar es «Mejorá tu plan» del aviso y lleva a los planes", async ({ page }) => {
  await miPlan(page, "suscripcion_comercio", { limite_exigido: true, max_turnos_mes: 5, turnos_usados_mes: 5 });
  await expect(page.getByText("Alcanzaste el límite de turnos de tu plan este mes.")).toBeVisible();
  expect(await ambares(page)).toEqual(["Mejorá tu plan"]);
  const aviso = page.locator(".tarjeta-suave", { hasText: "Alcanzaste el límite" }).getByRole("button", { name: "Mejorá tu plan" });
  expect(await aviso.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain("rgb(246, 169, 42)");
});

test("al límite y con falta pagar a la vez, el único ámbar es «Pagar el mes»", async ({ page }) => {
  await miPlan(page, "suscripcion_cobro_pendiente", { limite_exigido: true, max_turnos_mes: 5, turnos_usados_mes: 5 });
  await expect(page.getByText("Alcanzaste el límite de turnos de tu plan este mes.")).toBeVisible();
  expect(await ambares(page)).toEqual(["Pagar el mes"]);
});

test("con el aviso del plan elegido en la landing, el único ámbar es el del aviso, también al límite", async ({ page }) => {
  await miPlan(page, "suscripcion_comercio", { limite_exigido: true, max_turnos_mes: 5, turnos_usados_mes: 5 });
  await page.goto("/subscription?plan=basico");
  await expect(page.getByText(/Elegiste el plan/)).toBeVisible();
  await expect(page.getByText("Alcanzaste el límite de turnos de tu plan este mes.")).toBeVisible();
  expect(await ambares(page)).toHaveLength(1);
  const aviso = page.locator(".nota-ayuda").getByRole("button");
  expect(await aviso.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain("rgb(246, 169, 42)");
});

test("a 320 px nada corre la página y los precios entran enteros", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await miPlan(page, "suscripcion_cobro_pendiente");
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sobra).toBeLessThanOrEqual(0);
  const precio = await page.getByText("$45.000").first().boundingBox();
  expect(precio!.x + precio!.width).toBeLessThanOrEqual(320);
});

test("en la compu los tres planes van en tres columnas", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await miPlan(page, "suscripcion_comercio");
  const cajas = await page.locator("#planes .tarjeta-suave").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top));
  expect(cajas).toHaveLength(3);
  expect(Math.max(...cajas) - Math.min(...cajas)).toBeLessThan(2);
});
