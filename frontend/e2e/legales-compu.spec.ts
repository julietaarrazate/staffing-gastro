import { test, expect } from "@playwright/test";
import { blockExternalHosts, skipSplash } from "./mocks";

/** Términos y privacidad en compu: ancho de lectura e índice lateral fijo. El celular no cambia. */
for (const ruta of ["/terminos", "/privacidad"]) {
  test(`${ruta} en compu: texto de ~680 px e índice lateral que acompaña`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await skipSplash(page);
    await blockExternalHosts(page);
    await page.goto(ruta);
    const indice = page.getByRole("navigation", { name: "Índice del documento" });
    await expect(indice).toBeVisible();
    const tarjeta = (await page.locator("#cuerpo-legal").boundingBox())!;
    expect(tarjeta.width).toBeLessThanOrEqual(740);
    expect(tarjeta.width).toBeGreaterThanOrEqual(600);
    const i0 = (await indice.boundingBox())!;
    expect(i0.x + i0.width).toBeLessThanOrEqual(tarjeta.x);
    // Al bajar, el índice se queda a la vista.
    await page.evaluate(() => window.scrollTo(0, 1500));
    await page.waitForTimeout(300);
    const i1 = (await indice.getByRole("link").first().boundingBox())!;
    expect(i1.y).toBeGreaterThanOrEqual(0);
    expect(i1.y).toBeLessThan(200);
    // Un link del índice lleva a su sección.
    const link = indice.getByRole("link").nth(3);
    const titulo = (await link.textContent())!;
    await link.click();
    const h2 = page.getByRole("heading", { name: titulo, level: 2 });
    await expect(h2).toBeInViewport();
    await page.waitForTimeout(500);
    // No queda tapado por el header sticky (61 px) y el link clickeado queda activo.
    expect((await h2.boundingBox())!.y).toBeGreaterThanOrEqual(61);
    await expect(link).toHaveAttribute("aria-current", "true");
  });

  test(`${ruta} a 390 px: sin índice ni scroll horizontal`, async ({ page }) => {
    await skipSplash(page);
    await blockExternalHosts(page);
    await page.goto(ruta);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Índice del documento" })).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
}

test.describe("sin JavaScript (antes de hidratar)", () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  for (const ruta of ["/terminos", "/privacidad"]) {
    test(`${ruta}: la tarjeta ya mide 736 px en el HTML del servidor`, async ({ page }) => {
      await page.goto(ruta);
      const w = (await page.locator("#cuerpo-legal").boundingBox())!.width;
      expect(Math.round(w)).toBe(736);
    });
  }
});
