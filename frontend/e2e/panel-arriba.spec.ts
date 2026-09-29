import { test, expect } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * Lo de arriba del panel del comercio (2026-09-28, diagnóstico de
 * sobrecarga). Antes del primer turno había cinco capas; quedan el saludo,
 * Publicar (la acción, con acento) y Evento al lado, y el asistente.
 *
 * Reemplaza al spec de la fila de acciones rápidas, y conserva sus dos
 * reglas: una sola acción con el acento de marca (ADR-0011) y ningún
 * destino que ya esté en el nav de abajo.
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

test.describe("arriba del panel", () => {
  test.beforeEach(async ({ page }) => {
    await injectSession(page);
    await skipSplash(page);
    await blockExternalHosts(page);
    await page.route("**/api/v1/**", (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
        : route.continue()
    );
    await mockEmptyNotifications(page);
    await page.route("**/api/v1/auth/me", (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(EMPLOYER),
      })
    );
    await page.goto("/shifts");
  });

  test("'Publicar turno' lleva al alta y 'Evento' al alta de evento", async ({ page }) => {
    const main = page.locator("main");
    await expect(main.getByRole("link", { name: "Evento" })).toHaveAttribute("href", "/shifts/new-event");
    await main.getByRole("link", { name: "Publicar turno" }).click();
    await expect(page).toHaveURL(/\/shifts\/new$/);
  });

  test("sin la tarjeta 'Turnos activos' ni la fila de accesos rápidos", async ({ page }) => {
    await expect(page.getByRole("link", { name: "Publicar turno" })).toBeVisible();
    await expect(page.getByText("Turnos activos")).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Acciones rápidas" })).toHaveCount(0);
  });

  test("una sola acción lleva el acento de marca", async ({ page }) => {
    const publicar = page.getByRole("link", { name: "Publicar turno" });
    const evento = page.getByRole("link", { name: "Evento" });
    await expect(publicar).toBeVisible();
    // El acento se mide por el color REAL, no por la clase: así el test sigue
    // valiendo si mañana el token cambia de nombre.
    const primario = await page.evaluate(() => {
      const hex = getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim();
      const n = parseInt(hex.replace("#", ""), 16);
      return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
    });
    await expect(publicar).toHaveCSS("background-color", primario);
    expect(await evento.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(primario);
  });

  test("ninguna de las dos repite un destino del nav de abajo", async ({ page }) => {
    const nav = page.getByRole("navigation", { name: "Secciones" });
    await expect(nav.getByRole("link").first()).toBeVisible();
    const abajo = await nav
      .getByRole("link")
      .evaluateAll((els) => els.map((el) => new URL((el as HTMLAnchorElement).href).pathname));
    expect(abajo).not.toContain("/shifts/new");
    expect(abajo).not.toContain("/shifts/new-event");
  });
});
