import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

/**
 * Cuando los Términos cambian, a quien ya tiene cuenta se le pide aceptar la
 * versión vigente antes de seguir (`components/TerminosNuevos.tsx`,
 * 2026-11-26). Se acepta o se cierra la sesión; las páginas legales se pueden
 * leer sin el cartel encima.
 */
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const PERSONA = { id: "user-1", email: "t@oido.test", full_name: "Tere Términos", role: "worker", status: "activo", is_active: true, is_verified: true };

async function abrir(page: Page, pendiente: boolean, ruta = "/my-shifts") {
  const pedidos: string[] = [];
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await page.route("**/api/v1/**", (r) => (r.request().method() === "GET" ? r.fulfill(json([])) : r.continue()));
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json({ ...PERSONA, terms_acceptance_required: pendiente })));
  await page.route("**/api/v1/auth/terms/accept", (r) => {
    pedidos.push("accept");
    return r.fulfill({ status: 204 });
  });
  await page.goto(ruta);
  return pedidos;
}

for (const theme of ["light", "dark"] as const) {
  test(`${theme}: con una versión nueva sin aceptar, la app lo pide y «Acepto» lo registra`, async ({ page }) => {
    await setTheme(page, theme);
    const pedidos = await abrir(page, true);
    const cartel = page.getByRole("dialog", { name: "Actualizamos los Términos" });
    await expect(cartel).toBeVisible();
    await expect(cartel.getByRole("link", { name: "Términos y Condiciones" })).toHaveAttribute("href", "/terminos");
    await expect(cartel.getByRole("link", { name: "Política de Privacidad" })).toHaveAttribute("href", "/privacidad");
    // No se cierra sin decidir.
    await page.keyboard.press("Escape");
    await expect(cartel).toBeVisible();

    await cartel.getByRole("button", { name: "Acepto" }).click();

    await expect(cartel).toHaveCount(0);
    expect(pedidos).toEqual(["accept"]);
  });
}

test("quien ya aceptó la versión vigente no ve nada", async ({ page }) => {
  await abrir(page, false);
  await expect(page.getByRole("dialog", { name: "Actualizamos los Términos" })).toHaveCount(0);
});

test("las páginas legales se pueden leer sin el cartel encima", async ({ page }) => {
  await abrir(page, true, "/terminos");
  await expect(page.getByRole("heading", { level: 1, name: "Términos y Condiciones" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Actualizamos los Términos" })).toHaveCount(0);
  // Los Términos ya no dicen «no-show»: la gente no lo entiende.
  await expect(page.getByRole("heading", { name: "Cancelaciones y ausencias" })).toBeVisible();
  await expect(page.getByText(/no-show/i)).toHaveCount(0);
});
