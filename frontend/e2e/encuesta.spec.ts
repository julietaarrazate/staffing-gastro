import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, skipSplash } from "./mocks";

/**
 * Encuesta para locales (`/encuesta`, ADR-0025): pública, sin sesión, una
 * pregunta por pantalla. API mockeada.
 */

async function preparar(page: Page, onPost?: (body: Record<string, unknown>, headers: Record<string, string>) => void, status = 201) {
  await skipSplash(page);
  await blockExternalHosts(page);
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({ status: 404, contentType: "application/json", body: "{}" })
  );
  await page.route("**/api/v1/encuesta", (route) => {
    onPost?.(route.request().postDataJSON(), route.request().headers());
    return route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(status === 201 ? { received: true } : { detail: "Para sumarte a la beta dejanos un teléfono o un email" }),
    });
  });
}

/** El aviso de la pantalla (el anunciador de rutas de Next también es un `alert`). */
const aviso = (page: Page) => page.locator("p[role=alert]");
const siguiente = (page: Page) => page.getByRole("button", { name: "Siguiente" });

/** Rol, nombre del local, barrio y tipo: los cuatro primeros pasos. */
async function llenarInicio(page: Page, tipo: string) {
  await expect(async () => {
    await page.getByRole("radio", { name: "Dueño o dueña" }).click();
    await siguiente(page).click();
    await expect(page.getByLabel("Nombre del local")).toBeVisible({ timeout: 1000 });
  }).toPass();
  await page.getByLabel("Nombre del local").fill("Lo de Ana");
  await siguiente(page).click();
  await page.getByLabel("Barrio").fill("Palermo");
  await siguiente(page).click();
  await page.getByRole("radio", { name: tipo, exact: true }).click();
  await siguiente(page).click();
}

test("se completa de punta a punta sin sesión y manda todo en un pedido", async ({ page }) => {
  let body: Record<string, unknown> | null = null;
  let key: string | undefined;
  await preparar(page, (b, h) => {
    body = b;
    key = h["idempotency-key"];
  });
  await page.goto("/encuesta?ref=Grupo-Palermo");

  await expect(page.getByRole("heading", { name: "¿Cuál es tu rol en el local?" })).toBeVisible();
  // Sin elegir no se avanza, y dice por qué.
  // El primer toque puede llegar antes de que la página termine de cargar.
  await expect(async () => {
    await siguiente(page).click();
    await expect(aviso(page)).toContainText("Elegí una opción", { timeout: 1000 });
  }).toPass();
  await page.getByRole("radio", { name: "Encargado o encargada" }).click();
  await siguiente(page).click();

  // El nombre del local y el barrio son obligatorios.
  await expect(page.getByRole("heading", { name: "¿Cómo se llama el local?" })).toBeVisible();
  await siguiente(page).click();
  await expect(aviso(page)).toContainText("nombre del local");
  await page.getByLabel("Nombre del local").fill("Lo de Ana");
  await siguiente(page).click();
  await expect(page.getByRole("heading", { name: "¿En qué barrio está?" })).toBeVisible();
  await siguiente(page).click();
  await expect(aviso(page)).toContainText("barrio");
  await page.getByLabel("Barrio").fill("Palermo");
  await siguiente(page).click();

  await page.getByRole("radio", { name: "Bar", exact: true }).click();
  await siguiente(page).click();

  await page.getByRole("radio", { name: "Un poco de cada uno" }).click();
  await siguiente(page).click();
  await page.getByRole("radio", { name: "De 1 a 3" }).click();
  await siguiente(page).click();
  await page.getByRole("radio", { name: "De 4 a 10" }).click();
  await siguiente(page).click();

  await page.getByRole("checkbox", { name: "Mozo o moza" }).click();
  await page.getByRole("checkbox", { name: "Barra" }).click();
  await siguiente(page).click();
  await page.getByRole("checkbox", { name: "Grupos de WhatsApp" }).click();
  await siguiente(page).click();
  await page.getByRole("checkbox", { name: "Alguien hizo doble turno" }).click();
  await siguiente(page).click();

  await page.getByLabel("Pesos por persona, por una jornada de 8 horas").fill("40.000");
  await siguiente(page).click();
  await page.getByRole("radio", { name: "Pagar por cada turno cubierto" }).click();
  await siguiente(page).click();

  // Último paso: contacto.
  await expect(page.getByRole("heading", { name: "¿Querés sumarte a la beta?" })).toBeVisible();
  await page.getByLabel("Quiero sumarme a la beta").check();
  await page.getByRole("button", { name: "Enviar respuestas" }).click();
  await expect(aviso(page)).toContainText("teléfono o un email");
  await page.getByLabel("Teléfono").fill("11 5555-0000");
  await page.getByRole("button", { name: "Enviar respuestas" }).click();
  await expect(aviso(page)).toContainText("Marcá que aceptás");
  await page.getByLabel(/Acepto que Oído guarde/).check();
  await expect(page.getByRole("link", { name: "política de privacidad" })).toHaveAttribute("href", "/privacidad");
  await page.getByRole("button", { name: "Enviar respuestas" }).click();

  await expect(page.getByRole("heading", { name: "¡Gracias!" })).toBeVisible();
  await expect(page.getByText("Te vamos a escribir apenas abramos la beta.")).toBeVisible();

  expect(body).toMatchObject({
    respondent_role: "encargado",
    business_name: "Lo de Ana",
    local_kind: "bar",
    barrio: "Palermo",
    team_model: "mixto",
    eventuals_normal_month: "1-3",
    eventuals_peak_month: "4-10",
    roles: ["mozo", "barra"],
    current_channels: ["whatsapp"],
    last_absence_outcome: ["doble_turno"],
    pay_per_shift_ars: 40000,
    pricing_preference: "por_turno",
    wants_beta: true,
    phone: "11 5555-0000",
    consent: true,
    source: "grupo-palermo",
  });
  expect(key).toMatch(/^[0-9a-f-]{36}$/);
});

test("el contacto es opcional y Atrás conserva lo contestado", async ({ page }) => {
  let body: Record<string, unknown> | null = null;
  await preparar(page, (b) => {
    body = b;
  });
  await page.goto("/encuesta");
  await llenarInicio(page, "Café");
  await page.getByRole("button", { name: "Atrás" }).click();
  await page.getByRole("button", { name: "Atrás" }).click();
  await expect(page.getByLabel("Barrio")).toHaveValue("Palermo");
  await siguiente(page).click();
  await expect(page.getByRole("radio", { name: "Café" })).toHaveAttribute("aria-checked", "true");
  await siguiente(page).click();
  await page.getByRole("radio", { name: "Un equipo fijo" }).click();
  await siguiente(page).click();
  await page.getByRole("radio", { name: "Ninguna" }).click();
  await siguiente(page).click();
  await page.getByRole("radio", { name: "Ninguna" }).click();
  await siguiente(page).click();
  for (let i = 0; i < 3; i++) await siguiente(page).click(); // puestos, canales, ausencia
  await siguiente(page).click(); // pago: opcional
  await page.getByRole("radio", { name: "Todavía no sé" }).click();
  await siguiente(page).click();
  await page.getByRole("button", { name: "Enviar respuestas" }).click();
  await expect(page.getByRole("heading", { name: "¡Gracias!" })).toBeVisible();
  await expect(page.getByText("Tus respuestas nos ayudan")).toBeVisible();
  expect(body).toMatchObject({ respondent_role: "dueno", business_name: "Lo de Ana", local_kind: "cafe", wants_beta: false, consent: false });
  expect(body).not.toHaveProperty("phone");
});

test("un error del servidor se muestra y deja reintentar con la misma clave", async ({ page }) => {
  const keys: (string | undefined)[] = [];
  let intento = 0;
  await skipSplash(page);
  await blockExternalHosts(page);
  await page.route("**/api/v1/encuesta", (route) => {
    keys.push(route.request().headers()["idempotency-key"]);
    intento += 1;
    return intento === 1
      ? route.fulfill({ status: 500, contentType: "application/json", body: "{}" })
      : route.fulfill({ status: 201, contentType: "application/json", body: '{"received":true}' });
  });
  await page.goto("/encuesta");
  await llenarInicio(page, "Bar");
  await page.getByRole("radio", { name: "Un equipo fijo" }).click();
  await siguiente(page).click();
  await page.getByRole("radio", { name: "Ninguna" }).click();
  await siguiente(page).click();
  await page.getByRole("radio", { name: "Ninguna" }).click();
  await siguiente(page).click();
  for (let i = 0; i < 4; i++) await siguiente(page).click();
  await page.getByRole("radio", { name: "Todavía no sé" }).click();
  await siguiente(page).click();
  await page.getByRole("button", { name: "Enviar respuestas" }).click();
  await expect(aviso(page)).toBeVisible();
  await expect(page.getByRole("heading", { name: "¿Querés sumarte a la beta?" })).toBeVisible();
  await page.getByRole("button", { name: "Enviar respuestas" }).click();
  await expect(page.getByRole("heading", { name: "¡Gracias!" })).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
});

test("a 390 px no hay scroll horizontal y no hay barras de la app", async ({ page }) => {
  await preparar(page);
  await page.goto("/encuesta");
  await expect(page.getByRole("heading", { name: "¿Cuál es tu rol en el local?" })).toBeVisible();
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(ancho).toBeLessThanOrEqual(390);
  await expect(page.getByRole("navigation")).toHaveCount(0);
});
