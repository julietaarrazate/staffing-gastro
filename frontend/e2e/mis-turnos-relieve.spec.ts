import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, isoEnDias, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

/**
 * Mis turnos con la dirección «con relieve» (2026-11-18,
 * docs/historial/2026-11-18-mis-turnos-relieve.md): el encabezado sobre la
 * banda azul hondo con el título en brocha, y cada turno como comanda.
 */
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const WORKER = { id: "user-1", email: "w@oido.test", full_name: "Sofía Demo", role: "worker", status: "activo", is_active: true, is_verified: true };
const turno = (id: string, status: string, position: string) => ({
  id, company_id: "c1", position, quantity: 1, start_at: isoEnDias(1, "21:00"), end_at: isoEnDias(2, "02:00"), pay_amount: "20000", currency: "ARS",
  tips: true, meal: false, dress_code: null, urgent: false, address: null, city: "Palermo, CABA", latitude: null, longitude: null,
  title: null, description: null, status, worker_profile_id: "wp-1", created_at: "2026-07-01T12:00:00-03:00", company_name: "Bar Lavalle", company_logo_url: null,
});

async function misTurnos(page: Page) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  // Catch-all primero: Playwright resuelve la última ruta registrada.
  await page.route("**/api/v1/**", (r) => (r.request().method() === "GET" ? r.fulfill(json([])) : r.continue()));
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json(WORKER)));
  await page.route("**/api/v1/shifts/mine**", (r) => r.fulfill(json([turno("s1", "confirmado", "bartender"), turno("s2", "pagado", "mozo")])));
}

for (const theme of ["light", "dark"] as const) {
  test(`${theme}: el título va en brocha sobre la banda y se lee; cada turno es una comanda`, async ({ page }) => {
    await setTheme(page, theme);
    await misTurnos(page);
    await page.goto("/my-shifts");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    const titulo = page.getByRole("heading", { level: 1, name: "Matches" });
    await expect(titulo).toHaveClass(/letra-cartel/);
    // La tinta de la banda (blanco de día, claro de noche), no el azul de los títulos sobre claro.
    const colores = await titulo.evaluate((el) => ({
      letra: getComputedStyle(el).color,
      banda: getComputedStyle(el.closest(".app-banda") as HTMLElement).backgroundColor,
    }));
    expect(colores.letra).toBe(theme === "light" ? "rgb(255, 255, 255)" : "rgb(238, 243, 246)");
    expect(colores.banda).toBe(theme === "light" ? "rgb(28, 84, 120)" : "rgb(15, 58, 91)");
    for (const id of ["s1", "s2"]) {
      await expect(page.locator(`[data-shift-id="${id}"]`)).toHaveClass(/comanda/);
    }
    await expect(page.locator('[data-shift-id="s1"]').getByTestId("shift-status")).toHaveText("Confirmado");
    // El terminado (pagado) pierde el relieve, no la opacidad.
    await expect(page.locator('[data-shift-id="s2"]')).toHaveClass(/comanda-apagada/);
  });
}
