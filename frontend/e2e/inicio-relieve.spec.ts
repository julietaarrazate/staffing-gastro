import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, isoEnDias, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

/**
 * El Inicio del trabajador con la dirección «suave» (ADR-0028, 2026-11-19):
 * el cielo con el saludo y el título «Hay turno a la vuelta», la hoja debajo;
 * el recomendado es una tarjeta suave (foto con avisos como chips, puesto,
 * pago grande), «Cerca tuyo» son teclas y «Disponible» es un chip de vidrio.
 * (Hasta el 2026-11-19 era «con relieve»: comanda de papel y cartelito.)
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

test("el recomendado es una tarjeta: puesto, pago, local y cuándo, y «Para hoy» si es hoy", async ({ page }) => {
  await inicio(page, [
    turno("s1", {}),
    turno("s2", { position: "barista", company_name: "Café Colegiales", start_at: isoEnDias(3, "08:00"), end_at: isoEnDias(3, "14:00"), pay_amount: "12000" }),
  ]);
  await page.goto("/feed");
  // El saludo es una línea normal; el título de la pantalla es la frase.
  await expect(page.getByText("Hola, Sofía.", { exact: true })).toBeVisible();
  const titulo = page.getByRole("heading", { level: 1 });
  await expect(titulo).toHaveText(/Hay turno\s*a la vuelta/);
  const medidas = await titulo.evaluate((el) => ({ size: getComputedStyle(el).fontSize, peso: getComputedStyle(el).fontWeight, alto: getComputedStyle(el).lineHeight }));
  expect(medidas).toEqual({ size: "46px", peso: "800", alto: "46px" });
  const tarjeta = page.getByTestId("feed-hero-card");
  await expect(tarjeta.getByRole("heading", { name: "Mozo/a" })).toBeVisible();
  await expect(tarjeta).toContainText("Bar Lavalle · Palermo, CABA");
  await expect(tarjeta).toContainText("$20.000");
  await expect(tarjeta).toContainText("+ propinas");
  await expect(tarjeta).toContainText("Para hoy");
  await expect(tarjeta).not.toContainText("Urgente");
  // Toda la tarjeta abre el detalle del turno.
  await expect(tarjeta.getByRole("link", { name: "Ver turno: Mozo/a en Bar Lavalle" })).toHaveAttribute("href", "/turno/s1");
  // «Cerca tuyo» son teclas, no un carrusel: una por turno.
  const cerca = page.getByRole("region", { name: "Cerca tuyo" });
  await expect(cerca.getByRole("listitem")).toHaveCount(1);
  await expect(cerca.getByTestId("feed-nearby-card")).toContainText("$12.000");
  await expect(cerca.getByTestId("feed-nearby-card")).toHaveClass(/tecla/);
});

test("un turno urgente lleva el aviso «Urgente» y no «Para hoy», y la tarjeta es de la hoja también de noche", async ({ page }) => {
  await setTheme(page, "dark");
  await inicio(page, [turno("s1", { urgent: true })]);
  await page.goto("/feed");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const tarjeta = page.getByTestId("feed-hero-card");
  await expect(tarjeta).toContainText("Urgente");
  await expect(tarjeta).not.toContainText("Para hoy");
  // De noche la tarjeta es una superficie propia (no se funde con la hoja) y
  // el pago sigue leyéndose claro sobre ella.
  const colores = await tarjeta.evaluate((el) => ({
    tarjeta: getComputedStyle(el).backgroundColor,
    hoja: getComputedStyle(el.closest(".hoja")!).backgroundColor,
    pago: getComputedStyle(el.querySelector("p.tabular-nums")!).color,
  }));
  expect(colores.tarjeta).not.toBe(colores.hoja);
  expect(colores.pago).not.toBe(colores.tarjeta);
});

test("el chip «Disponible» dice su estado, avisa a los lectores de pantalla y mide 44 px", async ({ page }) => {
  await inicio(page, [turno("s1", {})]);
  await page.goto("/feed");
  const chip = page.getByRole("button", { name: "Cambiar disponibilidad" });
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await expect(chip).toHaveText("Disponible");
  const caja = await chip.boundingBox();
  expect(caja!.height).toBeGreaterThanOrEqual(44);
});

test("el cielo del Inicio lleva nubes decorativas de día y sólo estrellas de noche", async ({ page }) => {
  await inicio(page, [turno("s1", {})]);
  await page.goto("/feed");
  const nubes = page.locator(".app-cielo.cielo-limpio img.nube-cielo");
  await expect(nubes).toHaveCount(2);
  await expect(nubes.first()).toHaveAttribute("alt", "");
  await expect(nubes.first()).toHaveAttribute("aria-hidden", "true");
  await expect(nubes.first()).toBeVisible();
  await setTheme(page, "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(nubes.first()).toBeHidden();
});

test("el recomendado muestra la distancia como chip si se puede medir, con foto y sin foto, y nada si no", async ({ page }) => {
  await page.route("https://fotos.test/**", (r) =>
    r.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="2"><rect width="8" height="2" fill="#886"/></svg>' })
  );
  // Con foto: el chip va sobre la foto, junto a «Urgente».
  await inicio(page, [turno("s1", { urgent: true, company_cover_url: "https://fotos.test/bar.svg", latitude: -34.5966, longitude: -58.4257 })]);
  await page.goto("/feed");
  const tarjeta = page.getByTestId("feed-hero-card");
  const chip = tarjeta.getByTestId("feed-hero-distancia");
  await expect(chip).toHaveText("1,0 km");
  await expect(chip).toHaveClass(/chip-foto/);
  await expect(tarjeta).toContainText("Urgente");

  // Sin foto: el chip va arriba del puesto, con el mismo formato que «Cerca tuyo».
  await page.unroute("**/api/v1/shifts/feed**");
  await page.route("**/api/v1/shifts/feed**", (r) =>
    r.fulfill(json([turno("s1", { latitude: -34.5966, longitude: -58.4257 }), turno("s2", { latitude: -34.5966, longitude: -58.4257, position: "barista" })]))
  );
  await page.goto("/feed");
  await expect(page.getByTestId("feed-hero-card").getByTestId("feed-hero-distancia")).toHaveText("1,0 km");
  await expect(page.getByTestId("feed-nearby-card")).toContainText("1,0 km");

  // Sin ubicación del turno no se puede medir: ningún chip.
  await page.unroute("**/api/v1/shifts/feed**");
  await page.route("**/api/v1/shifts/feed**", (r) => r.fulfill(json([turno("s1", { latitude: null, longitude: null })])));
  await page.goto("/feed");
  await expect(page.getByTestId("feed-hero-card")).toBeVisible();
  await expect(page.getByTestId("feed-hero-distancia")).toHaveCount(0);
});
