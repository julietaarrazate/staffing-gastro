import { test, expect } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * El header de escritorio entra en UNA línea desde 768px (tablet vertical),
 * también para un comercio con nombre largo (auditoría visual 2026-09-24).
 *
 * Antes el botón decía "Salir (<nombre completo>)": con "Parrilla y
 * Vermutería Don Julián" los links pasaban a dos líneas hasta los ~1000px y
 * el header crecía de 61 a 77px. Lo que se fija acá es que ningún link ni el
 * botón de salir se parta, medido en el header real.
 */
test("el header del comercio no se parte en tablet con un nombre largo", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  // Catch-all primero: Playwright resuelve las rutas al revés (gana la última).
  await page.route("**/api/v1/**", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
      : route.continue()
  );
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "u-e",
        email: "e@oido.test",
        full_name: "Parrilla y Vermutería Don Julián",
        role: "employer",
        status: "activo",
        is_active: true,
        is_verified: true,
      }),
    })
  );

  await page.goto("/shifts");
  const salir = page.getByRole("button", { name: /^Salir/ });
  await expect(salir).toBeVisible();

  const partidos = await page.evaluate(() => {
    const nav = document.querySelector('header nav[aria-label="Principal"]')!;
    return [...nav.querySelectorAll("a, button")]
      .filter((el) => el.getBoundingClientRect().width > 0 && (el as HTMLElement).innerText.trim())
      .filter((el) => {
        const lh = parseFloat(getComputedStyle(el).lineHeight);
        return el.getBoundingClientRect().height > lh * 1.5 + 16;
      })
      .map((el) => (el as HTMLElement).innerText);
  });
  expect(partidos).toEqual([]);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
