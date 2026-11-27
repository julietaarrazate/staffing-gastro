import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, enDias, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * Decisión de Julieta (2026-11-27): el turno publicado en el local guarda la
 * dirección exacta del local (`address`), para que quien trabaja la vea en el
 * detalle con «Cómo llegar». En otra zona elegida a mano no hay calle: `address`
 * va vacío y no se arrastra la del local.
 */

const json = (body: unknown, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });

async function prepararSesion(page: Page) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) =>
    r.fulfill(json({ id: "user-1", email: "comercio@oido.test", full_name: "Bar La Esquina", role: "employer", status: "activo", is_active: true, is_verified: true })),
  );
  await page.route("**/api/v1/companies/me/profile", (r) =>
    r.fulfill(json({ id: "c1", name: "Bar La Esquina", category: "bar", description: null, address: "Gorriti 5000", city: "Buenos Aires", latitude: -34.58, longitude: -58.43, logo_url: null, cover_photo_url: null })),
  );
}

async function publicar(page: Page, cambiarZona: boolean) {
  await prepararSesion(page);
  let cuerpo: Record<string, unknown> | null = null;
  await page.route("**/api/v1/shifts", (r) => {
    if (r.request().method() !== "POST") return r.continue();
    cuerpo = r.request().postDataJSON();
    return r.fulfill(json({ id: "s-1" }, 201));
  });
  await page.route("**/api/v1/shifts/s-1/publish", (r) => r.fulfill(json({})));
  await page.goto("/shifts/new");
  await page.getByRole("button", { name: "Mozo/a" }).click();
  await page.locator('input[type="datetime-local"]').nth(0).fill(enDias(3, "20:00"));
  await page.locator('input[type="datetime-local"]').nth(1).fill(enDias(3, "23:00"));
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByPlaceholder("48.000").fill("15000");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("¿Dónde es?")).toBeVisible();
  if (cambiarZona) {
    await page.getByRole("button", { name: "Cambiar" }).click();
    await page.locator("select").nth(1).selectOption("Palermo");
  } else {
    await expect(page.getByText("Gorriti 5000").first()).toBeVisible();
  }
  await page.getByRole("button", { name: "Publicar turno" }).click();
  await expect(page.getByText("¡Turno publicado!")).toBeVisible();
  return cuerpo as unknown as Record<string, unknown>;
}

test("publicado en el local: el pedido lleva la dirección exacta del local", async ({ page }) => {
  const cuerpo = await publicar(page, false);
  expect(cuerpo.address).toBe("Gorriti 5000");
  expect(cuerpo.latitude).toBe(-34.58);
});

test("publicado en otra zona elegida a mano: no lleva la dirección del local", async ({ page }) => {
  const cuerpo = await publicar(page, true);
  expect(cuerpo.address).toBeNull();
  expect(cuerpo.city).toContain("Palermo");
});
