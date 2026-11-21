import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

/**
 * La bienvenida (2026-11-19, docs/historial/2026-11-19-bienvenida-relieve.md):
 * el cielo arriba con el «oído» plano (sin el fileteado, que Julieta vio
 * cargado, y sin la cafetera) y los pasos en un renglón, tachando lo hecho.
 * Desde el 2026-11-21 (dirección suave, e2e/acceso-suave.spec.ts) la pregunta
 * va en letra normal en el cielo y no en brocha adentro del paso.
 */
const json = (body: unknown, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });

async function abrir(page: Page, theme: "light" | "dark", role: "employer" | "worker") {
  await setTheme(page, theme);
  await skipSplash(page);
  await injectSession(page);
  await blockExternalHosts(page);
  // Catch-all primero: Playwright resuelve la última ruta registrada.
  await page.route("**/api/v1/**", (r) => (r.request().method() === "GET" ? r.fulfill(json([])) : r.continue()));
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) =>
    r.fulfill(json({ id: "u", email: "n@oido.test", full_name: "Nuevo", role, status: "activo", is_active: true, is_verified: true })),
  );
  await page.route("**/api/v1/companies/me/profile", (r) => r.fulfill(json({ detail: "no" }, 404)));
  await page.route("**/api/v1/workers/me/profile", (r) => r.fulfill(json({ detail: "no" }, 404)));
  await page.goto("/bienvenida");
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

for (const theme of ["light", "dark"] as const) {
  test(`${theme}: el comercio ve el cielo con el «oído» plano, la pregunta y los pasos`, async ({ page }) => {
    await abrir(page, theme, "employer");
    const titulo = page.getByRole("heading", { level: 1, name: /Cómo se llama tu comercio/ });
    await expect(titulo).toHaveClass(/titulo-pantalla/);
    // El «oído» plano sobre el cielo; ni el fileteado ni la cafetera.
    const cielo = page.locator(".app-cielo").first();
    await expect(cielo).toContainText("oído");
    await expect(cielo.locator("svg")).toHaveCount(0);
    const pasos = page.getByRole("list", { name: "Paso 1 de 2: Tu comercio" });
    await expect(pasos.locator('[aria-current="step"]')).toHaveText("Tu comercio");

    await page.getByRole("textbox", { name: "Nombre del comercio" }).fill("Bar Lavalle");
    await page.getByRole("button", { name: "Continuar" }).click();
    const paso2 = page.getByRole("list", { name: "Paso 2 de 2: Ubicación" });
    await expect(paso2).toBeVisible();
    // Lo hecho, tachado a mano.
    await expect(paso2.locator("li").first().locator("svg.tacha")).toHaveCount(1);
  });

  test(`${theme}: el trabajador ve la pregunta y sus tres pasos`, async ({ page }) => {
    await abrir(page, theme, "worker");
    await expect(page.getByRole("heading", { level: 1 })).toHaveClass(/titulo-pantalla/);
    await expect(page.getByRole("list", { name: "Paso 1 de 3: Zona" })).toBeVisible();
  });
}
