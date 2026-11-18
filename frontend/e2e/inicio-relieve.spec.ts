import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, isoEnDias, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

/**
 * El Inicio del trabajador con la dirección «con relieve» (2026-11-18,
 * docs/historial/2026-11-18-inicio-trabajador-relieve.md): el recomendado es
 * una comanda de papel, con un solo aviso («Urgente» o «para hoy»), «Cerca
 * tuyo» es una lista y «Disponible» es un cartelito que dice su estado.
 */
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

const turno = (id: string, extra: Record<string, unknown>) => ({
  id,
  company_id: "company-1",
  position: "mozo",
  quantity: 1,
  start_at: isoEnDias(0, "23:00"),
  end_at: isoEnDias(1, "02:00"),
  pay_amount: "20000",
  currency: "ARS",
  tips: true,
  dress_code: null,
  urgent: false,
  address: null,
  city: "Palermo, CABA",
  latitude: -34.5875,
  longitude: -58.4257,
  title: null,
  description: null,
  status: "publicado",
  worker_profile_id: null,
  check_in_latitude: null,
  check_in_longitude: null,
  check_in_at: null,
  check_out_latitude: null,
  check_out_longitude: null,
  check_out_at: null,
  paid_at: null,
  created_at: "2026-07-01T12:00:00-03:00",
  company_name: "Bar Lavalle",
  company_logo_url: null,
  ...extra,
});

async function inicio(page: Page, feed: unknown[]) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) =>
    r.fulfill(json({ id: "user-1", email: "demo@staffya.com", full_name: "Sofía Demo", role: "worker", status: "activo", is_active: true, is_verified: true }))
  );
  await page.route("**/api/v1/shifts/feed**", (r) => r.fulfill(json(feed)));
  await page.route("**/api/v1/applications/mine", (r) => r.fulfill(json([])));
  await page.route("**/api/v1/workers/me/profile", (r) =>
    r.fulfill(
      json({ id: "profile-1", user_id: "user-1", full_name: "Sofía Demo", photo_url: null, city: "Palermo, CABA", latitude: -34.5875, longitude: -58.4257, skills: ["mozo"], languages: [], certifications: [], is_available: true, rating: 4.8, events_completed: 10, punctuality_rate: 0.95, cancellations: 0, badges: [], level: "plata" })
    )
  );
}

test("el recomendado es una comanda: puesto, local, cuándo y pago, y «para hoy» si es hoy", async ({ page }) => {
  await inicio(page, [
    turno("s1", {}),
    turno("s2", { position: "barista", company_name: "Café Colegiales", start_at: isoEnDias(3, "08:00"), end_at: isoEnDias(3, "14:00"), pay_amount: "12000" }),
  ]);
  await page.goto("/feed");
  await expect(page.getByRole("heading", { level: 1, name: "Hola, Sofía" })).toBeVisible();
  const comanda = page.getByTestId("feed-hero-card");
  await expect(comanda.getByRole("heading", { name: "Mozo/a" })).toBeVisible();
  await expect(comanda).toContainText("Bar Lavalle · Palermo, CABA");
  await expect(comanda.locator("dl")).toContainText("Cuándo");
  await expect(comanda.locator("dl")).toContainText("$20.000 + propinas");
  await expect(comanda).toContainText("para hoy");
  await expect(comanda).not.toContainText("Urgente");
  // Toda la comanda abre el detalle del turno.
  await expect(comanda.getByRole("link", { name: "Ver turno: Mozo/a en Bar Lavalle" })).toHaveAttribute("href", "/turno/s1");
  // «Cerca tuyo» es una lista, no un carrusel: un renglón por turno.
  const cerca = page.getByRole("region", { name: "Cerca tuyo" });
  await expect(cerca.getByRole("listitem")).toHaveCount(1);
  await expect(cerca.getByTestId("feed-nearby-card")).toContainText("$12.000");
});

test("un turno urgente lleva el sello y no el apunte, y el papel es claro también de noche", async ({ page }) => {
  await setTheme(page, "dark");
  await inicio(page, [turno("s1", { urgent: true })]);
  await page.goto("/feed");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const comanda = page.getByTestId("feed-hero-card");
  await expect(comanda).toContainText("Urgente");
  await expect(comanda).not.toContainText("para hoy");
  // El papel sigue claro en oscuro, y la tinta de adentro es la de claro.
  const colores = await comanda.evaluate((el) => ({
    papel: getComputedStyle(el).backgroundColor,
    tinta: getComputedStyle(el.querySelector("dd")!).color,
  }));
  expect(colores.papel).toBe("rgb(238, 243, 246)");
  expect(colores.tinta).toBe("rgb(17, 17, 17)");
});

test("el cartelito dice si está disponible y avisa su estado a los lectores de pantalla", async ({ page }) => {
  await inicio(page, [turno("s1", {})]);
  await page.goto("/feed");
  const cartelito = page.getByRole("button", { name: "Cambiar disponibilidad" });
  await expect(cartelito).toHaveAttribute("aria-pressed", "true");
  await expect(cartelito).toHaveText("Disponible");
  const caja = await cartelito.boundingBox();
  expect(caja!.height).toBeGreaterThanOrEqual(44);
});
