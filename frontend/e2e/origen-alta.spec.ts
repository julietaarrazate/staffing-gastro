import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * Origen de cada alta (fase 0 del plan de crecimiento, `lib/origen-alta.ts`):
 * el enlace con el que la persona entra (`?ref=`, `utm_*`) se guarda al abrir
 * cualquier página y viaja en el alta, aunque se registre más tarde y desde
 * otra página. Toda la API mockeada.
 */

const WORKER = {
  id: "user-7",
  email: "nueva.moza@staffya.com",
  full_name: "Moza Nueva",
  role: "worker",
  status: "activo",
  is_active: true,
  is_verified: false,
};

function json(body: unknown, status = 200) {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

async function mockAlta(page: Page): Promise<Record<string, unknown>[]> {
  await skipSplash(page);
  await blockExternalHosts(page);
  await page.route("**/api/v1/**", (route) => route.fulfill(json({}, 404)));
  await mockEmptyNotifications(page);
  const altas: Record<string, unknown>[] = [];
  await page.route("**/api/v1/auth/register", (route) => {
    altas.push(route.request().postDataJSON());
    return route.fulfill(json(WORKER, 201));
  });
  await page.route("**/api/v1/auth/login", (route) =>
    route.fulfill(json({ access_token: "tok-nuevo", token_type: "bearer", user: WORKER }))
  );
  await page.route("**/api/v1/auth/me", (route) => route.fulfill(json(WORKER)));
  return altas;
}

async function completarAlta(page: Page) {
  await page.getByPlaceholder("Nombre completo").fill("Moza Nueva");
  await page.getByLabel("Fecha de nacimiento").fill("1995-05-20");
  await page.getByPlaceholder("Email").fill("nueva.moza@staffya.com");
  await page.getByPlaceholder("Contraseña (mín. 8 caracteres)").fill("unaClaveLarga1");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Crear cuenta" }).click();
}

test("el enlace con el que entró viaja en el alta, aunque se registre después", async ({ page }) => {
  const altas = await mockAlta(page);
  // Entra por el enlace de la bio (Instagram le agrega sus utm) y se va.
  await page.goto("/encuesta?utm_source=ig&utm_campaign=bio&utm_medium=social");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("oido_origen_alta"))).not.toBeNull();
  // Vuelve otro día escribiendo la dirección: sin parámetros, no pisa el origen.
  await page.goto("/register");
  await completarAlta(page);
  await expect.poll(() => altas.length).toBe(1);
  expect(altas[0].origen).toEqual({ utm_source: "ig", utm_campaign: "bio" });
  // Con la cuenta creada, el origen se borra: no vuelve a viajar.
  await expect.poll(() => page.evaluate(() => localStorage.getItem("oido_origen_alta"))).toBeNull();
});

test("con ?ref= gana el código propio; sin enlace con origen no viaja nada", async ({ page }) => {
  const altas = await mockAlta(page);
  await page.goto("/register?ref=grupo-palermo");
  await completarAlta(page);
  await expect.poll(() => altas.length).toBe(1);
  expect(altas[0].origen).toEqual({ ref: "grupo-palermo" });

  await page.evaluate(() => localStorage.clear());
  await page.goto("/register");
  await completarAlta(page);
  await expect.poll(() => altas.length).toBe(2);
  expect(altas[1]).not.toHaveProperty("origen");
});
