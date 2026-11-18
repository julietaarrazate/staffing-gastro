import { test, expect, type Locator } from "@playwright/test";
import { blockExternalHosts, setTheme, skipSplash } from "./mocks";

/**
 * Un solo indicador de foco por campo (2026-11-18). El contorno global de la
 * marca (`--focus-ring`, globals.css) es el único; los campos ya no suman un
 * anillo propio (`focus:ring-2 focus:ring-primary/40`, ámbar) encimado. El
 * borde de reposo (`ring-1 ring-line`) sí queda: es una sombra de 1px.
 */

/** Capas de `box-shadow` con anillo de 2px o más (spread) y color visible. */
async function anillosDeFoco(el: Locator): Promise<string[]> {
  return el.evaluate((n) => {
    const sombra = getComputedStyle(n as HTMLElement).boxShadow;
    // Separa por comas fuera de paréntesis.
    const capas = sombra.split(/,(?![^(]*\))/).map((c) => c.trim());
    return capas.filter((c) => {
      if (/^rgba\(0, 0, 0, 0\)/.test(c)) return false;
      const px = c.match(/(-?[\d.]+)px/g)?.map((v) => parseFloat(v)) ?? [];
      return px.length >= 4 && px[3] >= 2;
    });
  });
}

async function afirmarUnSoloFoco(el: Locator) {
  // `transition` anima el contorno y la sombra: se espera a que terminen.
  await expect.poll(() => el.evaluate((n) => getComputedStyle(n).outlineWidth)).toBe("2px");
  await el.evaluate((n) => Promise.all(n.getAnimations().map((a) => a.finished)));
  expect(await el.evaluate((n) => getComputedStyle(n).outlineStyle)).toBe("solid");
  expect(await anillosDeFoco(el)).toEqual([]);
}

for (const theme of ["light", "dark"] as const) {
  test(`un campo enfocado tiene un solo indicador (${theme})`, async ({ page }) => {
    await skipSplash(page);
    await setTheme(page, theme);
    await blockExternalHosts(page);

    await page.goto("/login");
    const email = page.getByPlaceholder("Email");
    await email.click(); // tap
    await afirmarUnSoloFoco(email);

    await page.getByPlaceholder("Contraseña").click();
    await page.keyboard.press("Shift+Tab"); // teclado
    await afirmarUnSoloFoco(email);

    await page.goto("/register");
    const nombre = page.getByLabel("Nombre completo");
    await nombre.click();
    await afirmarUnSoloFoco(nombre);
  });
}
