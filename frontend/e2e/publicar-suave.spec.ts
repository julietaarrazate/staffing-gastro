import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, enDias, injectSession, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

/**
 * «Publicar turno» y «Publicar evento» con la dirección suave (ADR-0028,
 * 2026-11-19): el cielo arriba con el título en letra normal grande (no en
 * brocha), la hoja blanca abajo, los puestos como teclas, el sí/no como una
 * casilla redonda, y el pedido del último paso como la tarjeta del turno con
 * el pago grande. En claro y en oscuro, y sin scroll horizontal a 320 px.
 */
const EMPLOYER = {
  id: "user-1",
  email: "comercio@oido.test",
  full_name: "Bar La Esquina",
  role: "employer",
  status: "activo",
  is_active: true,
  is_verified: true,
};

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

const PERFIL = {
  id: "c1",
  user_id: "user-1",
  name: "Bar La Esquina",
  logo_url: null,
  category: null,
  description: null,
  address: "Honduras 5200",
  city: "Palermo, CABA",
  latitude: -34.5875,
  longitude: -58.4257,
  capacity: null,
  opening_hours: null,
  rating: 4.5,
  events_published: 0,
  on_time_payment_rate: 1,
  late_cancellations: 0,
};

async function preparar(page: Page, theme: "light" | "dark" = "light") {
  await setTheme(page, theme);
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await page.route("**/api/v1/**", (route) =>
    route.fulfill(json(route.request().method() === "GET" ? [] : {}))
  );
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) => route.fulfill(json(EMPLOYER)));
  await page.route("**/api/v1/companies/me/profile", (route) => route.fulfill(json(PERFIL)));
}

async function sinScrollHorizontal(page: Page) {
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(ancho).toBeLessThanOrEqual(0);
}

for (const theme of ["light", "dark"] as const) {
  test(`publicar turno, de punta a punta en la dirección suave (${theme})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await preparar(page, theme);
    await page.goto("/shifts/new");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.locator(".estilo-suave")).toHaveCount(1);

    // El título en letra normal, no en brocha.
    const titulo = page.getByRole("heading", { level: 1, name: "¿Qué necesitás?" });
    await expect(titulo).toHaveClass(/titulo-pantalla/);
    await expect(titulo).not.toHaveClass(/letra-cartel/);
    await expect(page.getByRole("list", { name: "Paso 1 de 4: Puesto" })).toBeVisible();

    // Los puestos son teclas, sin íconos.
    const mozo = page.getByRole("button", { name: "Mozo/a" });
    await expect(mozo).toHaveClass(/tecla/);
    await expect(mozo.locator("svg")).toHaveCount(0);
    await mozo.click();

    await expect(page.getByRole("heading", { name: "¿Cuándo?" })).toBeVisible();
    const fechas = page.locator('input[type="datetime-local"]');
    await fechas.nth(0).fill(enDias(3, "20:00"));
    await fechas.nth(1).fill(enDias(4, "03:00"));
    await page.getByRole("button", { name: "Continuar" }).click();

    // El sí/no: casilla redonda a la vista, el interruptor de antes oculto.
    await expect(page.getByRole("heading", { name: "¿Cuánto pagás?" })).toBeVisible();
    await page.getByPlaceholder("48.000").fill("48000");
    const comida = page.getByRole("switch", { name: /Incluye comida/ });
    await expect(comida.locator(".casilla")).toBeVisible();
    await expect(comida.locator(".interruptor")).toBeHidden();
    await expect(comida).toHaveAttribute("aria-checked", "false");
    await comida.click();
    await expect(comida).toHaveAttribute("aria-checked", "true");
    await page.getByRole("button", { name: "Continuar" }).click();

    // El pedido: la tarjeta con el puesto, el horario y el pago grande.
    await expect(page.getByRole("heading", { name: "¿Dónde es?" })).toBeVisible();
    const pedido = page.getByRole("region", { name: "El turno" });
    await expect(pedido).toBeVisible();
    await expect(pedido.getByRole("heading", { name: "Mozo/a" })).toBeVisible();
    await expect(pedido.getByText("$48.000")).toBeVisible();
    await expect(pedido.getByText(/→/)).toBeVisible();
    await expect(pedido.getByText("Comida")).toBeVisible();
    await expect(page.getByRole("button", { name: "Publicar turno" })).toBeEnabled();
    await sinScrollHorizontal(page);
  });
}

test("a 320 px ningún paso se sale de la pantalla", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await preparar(page);
  await page.goto("/shifts/new");
  await page.evaluate(() => document.fonts.ready);
  await sinScrollHorizontal(page);
  await page.getByRole("button", { name: "Personal de eventos" }).click();
  await expect(page.getByRole("heading", { name: "¿Cuándo?" })).toBeVisible();
  await sinScrollHorizontal(page);
  const fechas = page.locator('input[type="datetime-local"]');
  await fechas.nth(0).fill(enDias(3, "20:00"));
  await fechas.nth(1).fill(enDias(4, "03:00"));
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByPlaceholder("48.000").fill("1250000");
  await sinScrollHorizontal(page);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("region", { name: "El turno" })).toBeVisible();
  await sinScrollHorizontal(page);
});

test("en la compu, la vista previa es la misma tarjeta y se va llenando", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await preparar(page);
  await page.goto("/shifts/new");
  const vista = page.getByRole("region", { name: "Vista previa del turno" });
  await expect(vista).toBeVisible();
  await expect(vista.getByText("¿Qué puesto?")).toBeVisible();
  await page.getByRole("button", { name: "Bartender" }).click();
  await expect(vista.getByRole("heading", { name: "Bartender" })).toBeVisible();
});

for (const theme of ["light", "dark"] as const) {
  test(`publicar evento en la dirección suave (${theme})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await preparar(page, theme);
    await page.goto("/shifts/new-event");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.locator(".estilo-suave")).toHaveCount(1);
    const titulo = page.getByRole("heading", { level: 1, name: "Publicar para un evento" });
    await expect(titulo).toHaveClass(/titulo-pantalla/);
    await expect(page.getByText("Honduras 5200").first()).toBeVisible();
    const propinas = page.getByRole("switch", { name: /Acepta propinas/ });
    await expect(propinas.locator(".casilla")).toBeVisible();
    await sinScrollHorizontal(page);
  });
}

test("en la compu, el último paso no repite la tarjeta del turno: queda sólo la vista previa", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await preparar(page);
  await page.goto("/shifts/new");
  await page.getByRole("button", { name: "Bartender" }).click();
  const fechas = page.locator('input[type="datetime-local"]');
  await fechas.nth(0).fill(enDias(3, "20:00"));
  await fechas.nth(1).fill(enDias(4, "03:00"));
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByPlaceholder("48.000").fill("48000");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "¿Dónde es?" })).toBeVisible();
  await expect(page.getByRole("region", { name: "El turno", exact: true })).toBeHidden();
  const vista = page.getByRole("region", { name: "Vista previa del turno" });
  await expect(vista.getByText("$48.000")).toBeVisible();
  // Formulario con ancho de lectura, a la izquierda de la vista previa.
  const hoja = await page.locator(".hoja").boundingBox();
  const caja = await vista.boundingBox();
  expect(hoja!.width).toBeLessThanOrEqual(660);
  expect(caja!.x).toBeGreaterThanOrEqual(hoja!.x + hoja!.width);
});

test("en la compu, publicar evento suma un resumen al costado y el formulario queda en ancho de lectura", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await preparar(page);
  await page.goto("/shifts/new-event");
  const resumen = page.getByRole("complementary", { name: "Resumen del evento" });
  await expect(resumen).toBeVisible();
  await page.getByLabel("Nombre del evento").fill("Boda Martínez");
  await page.getByPlaceholder("15.000").fill("30000");
  await expect(resumen.getByText("Boda Martínez")).toBeVisible();
  await expect(resumen.getByText("1 × Mozo/a")).toBeVisible();
  await expect(resumen.getByText("Total en pagos: $30.000")).toBeVisible();
  const hoja = await page.locator(".hoja").boundingBox();
  const lado = await resumen.boundingBox();
  expect(hoja!.width).toBeLessThanOrEqual(660);
  expect(lado!.x).toBeGreaterThanOrEqual(hoja!.x + hoja!.width);
  await expect(page.getByLabel("Nombre del evento")).toBeVisible();
  const campo = await page.getByLabel("Nombre del evento").boundingBox();
  expect(campo!.width).toBeLessThanOrEqual(640);
});

test("en el celular, publicar evento no muestra el resumen del costado", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparar(page);
  await page.goto("/shifts/new-event");
  await expect(page.getByRole("heading", { name: "Publicar para un evento" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Resumen del evento" })).toBeHidden();
});
