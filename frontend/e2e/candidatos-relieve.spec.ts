import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

/**
 * Candidatos con la dirección «con relieve» (2026-11-18,
 * docs/historial/2026-11-18-candidatos-relieve.md): el turno como comanda
 * bajo el cielo, y en cada pestaña el destacado con el relieve del filete y
 * su apunte a mano; los demás, planos.
 */
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const EMPLOYER = { id: "user-1", email: "c@oido.test", full_name: "Julieta Demo", role: "employer", status: "activo", is_active: true, is_verified: true };
const persona = (id: string, nombre: string, extra: Record<string, unknown> = {}) => ({
  application_id: `app-${id}`, worker_profile_id: `wp-${id}`, full_name: nombre, photo_url: null, rating: 4.6, is_available: true,
  status: "pendiente", created_at: "2026-11-10T12:00:00-03:00", events_completed: 8, punctuality_rate: 0.92, years_experience: 2,
  badges: [], level: "bronce", ...extra,
});
const SHIFT = {
  id: "shift-1", company_id: "c1", position: "mozo", quantity: 1, start_at: "2026-12-10T21:00:00-03:00", end_at: "2026-12-11T02:00:00-03:00",
  pay_amount: "20000", currency: "ARS", tips: true, dress_code: null, urgent: false, address: null, city: "Palermo", latitude: null, longitude: null,
  title: null, description: null, status: "publicado", worker_profile_id: null, created_at: "2026-11-01T12:00:00-03:00", company_name: "Bar Lavalle", company_logo_url: null,
};

async function candidatos(page: Page) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json(EMPLOYER)));
  await page.route("**/api/v1/shifts/shift-1", (r) => r.fulfill(json(SHIFT)));
  await page.route("**/api/v1/applications/shifts/shift-1", (r) =>
    r.fulfill(json([persona("1", "Sofía Ramírez", { rating: 4.9, events_completed: 38 }), persona("2", "Lucas Medina")]))
  );
  await page.route("**/api/v1/shifts/shift-1/candidates", (r) =>
    r.fulfill(json([
      { profile_id: "wp-9", full_name: "Mateo Sugerido", photo_url: null, rating: 4.8, distance_km: 0.8, score: 0.91, events_completed: 23, punctuality_rate: 0.96 },
      { profile_id: "wp-8", full_name: "Ana Torres", photo_url: null, rating: 4.4, distance_km: 2.1, score: 0.7 },
    ]))
  );
}

test("el turno es una comanda bajo el cielo, y el mejor postulante lleva el relieve y su apunte", async ({ page }) => {
  await candidatos(page);
  await page.goto("/shifts/shift-1/candidates");
  await expect(page.getByRole("heading", { level: 1, name: "Candidatos" })).toBeVisible();
  const turno = page.getByRole("region", { name: "El turno" });
  await expect(turno).toHaveClass(/comanda/);
  await expect(turno).toContainText("Mozo/a");
  await expect(turno).toContainText("$20.000");
  const destacado = page.locator("[data-destacado]");
  await expect(destacado).toHaveCount(1);
  await expect(destacado).toContainText("Mejor valorado");
  await expect(destacado).toContainText("Sofía Ramírez");
  await expect(destacado).toHaveClass(/tarjeta-relieve/);
  expect(await destacado.evaluate((el) => getComputedStyle(el).boxShadow)).toContain("5px 5px 0px");
  // El otro, plano.
  const otro = page.locator(".no-select", { hasText: "Lucas Medina" }).first();
  expect(await otro.evaluate((el) => getComputedStyle(el).boxShadow)).not.toContain("5px 5px 0px");
});

test("en Recomendados, el primero dice «el que te recomendamos», con relieve, también de noche", async ({ page }) => {
  await setTheme(page, "dark");
  await candidatos(page);
  await page.goto("/shifts/shift-1/candidates");
  await page.getByRole("button", { name: /Recomendados/ }).click();
  const recomendado = page.locator("[data-recomendado]");
  await expect(recomendado).toHaveCount(1);
  await expect(recomendado).toContainText("el que te recomendamos");
  await expect(recomendado).toContainText("Mateo Sugerido");
  await expect(recomendado).toHaveClass(/tarjeta-relieve/);
  // De noche el relieve va en el azul de noche (#2e6e99), que se despega del lienzo.
  expect(await recomendado.evaluate((el) => getComputedStyle(el).boxShadow)).toContain("rgb(46, 110, 153)");
});
