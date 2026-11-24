import { test, expect } from "@playwright/test";
import { blockExternalHosts, skipSplash } from "./mocks";

/**
 * El acceso en la compu (2026-11-24, `docs/planning/ESCRITORIO_PANTALLAS.md`,
 * renglón 18): desde `lg` va en dos columnas, el cielo con qué es Oído a la
 * izquierda y la hoja con el formulario a la derecha. En el celular, una sola
 * columna y sin el bloque de qué es Oído (el formulario va primero).
 */
const QUE_ES = "Turnos de gastronomía en CABA, en el momento.";

for (const ruta of ["/login", "/register"]) {
  test(`${ruta} en la compu: dos columnas, sin desborde`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await skipSplash(page);
    await blockExternalHosts(page);
    await page.goto(ruta);
    const cielo = page.locator(".acceso > .app-cielo");
    const hoja = page.locator(".acceso > .acceso-hoja");
    await expect(page.getByText(QUE_ES)).toBeVisible();
    const c = (await cielo.boundingBox())!;
    const h = (await hoja.boundingBox())!;
    // La hoja va al lado del cielo, no debajo.
    expect(h.x).toBeGreaterThanOrEqual(c.x + c.width - 2);
    expect(Math.abs(h.y - c.y)).toBeLessThan(4);
    expect(await page.locator("h1").count()).toBe(1);
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(ancho).toBeLessThanOrEqual(0);
  });
}

test("/login en el celular: una columna y sin el bloque de qué es Oído", async ({ page }) => {
  await skipSplash(page);
  await blockExternalHosts(page);
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Ingresar" })).toBeVisible();
  await expect(page.getByText(QUE_ES)).toBeHidden();
  const c = (await page.locator(".acceso > .app-cielo").boundingBox())!;
  const h = (await page.locator(".acceso > .acceso-hoja").boundingBox())!;
  expect(h.y).toBeGreaterThan(c.y + c.height - 40);
});
