import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * Publicar para un evento (`/shifts/new-event`) no sale sin zona.
 *
 * Antes el formulario no precargaba el local ni exigía zona: el alta
 * respondía 201 con ciudad y coordenadas vacías, el panel mostraba
 * «Ubicación a confirmar» y ningún trabajador cercano recibía el aviso
 * (hallazgo U058 de la prueba de punta a punta, 2026-11-13).
 *
 * Ahora arranca en el local del comercio (igual que el asistente de turno),
 * deja cambiarlo, y sin zona el botón queda deshabilitado con una línea que
 * dice qué falta.
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

const LOCAL = {
  id: "company-1",
  user_id: "user-1",
  name: "Bar La Esquina",
  address: "Honduras 5200, Palermo",
  city: "Palermo",
  latitude: -34.5875,
  longitude: -58.43,
};

type Cuerpo = Record<string, unknown>;

async function abrirFormulario(page: Page, perfil: Cuerpo | null) {
  const publicados: Cuerpo[] = [];
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await page.route("**/api/v1/**", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
      : route.continue()
  );
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(EMPLOYER) })
  );
  await page.route("**/api/v1/companies/me/profile", (route) =>
    perfil
      ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(perfil) })
      : route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Todavía no cargaste tu local" }),
        })
  );
  await page.route("**/api/v1/shifts/events", (route) => {
    publicados.push(route.request().postDataJSON());
    return route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ event_id: "ev-1", requested: 1, shifts: [{ id: "s-1" }] }),
    });
  });
  await page.goto("/shifts/new-event");
  return publicados;
}

async function completarLoDemas(page: Page) {
  await page.getByLabel("Nombre del evento").fill("Boda Martínez");
  const campos = page.locator('input[type="datetime-local"]');
  await campos.nth(0).fill("2027-03-20T21:00");
  await campos.nth(1).fill("2027-03-21T04:00");
  await page.getByPlaceholder("15000").fill("30000");
}

const publicar = (page: Page) => page.getByRole("button", { name: "Publicar evento" });

test("con local cargado: toma su zona, la muestra y publica con ella", async ({ page }) => {
  const publicados = await abrirFormulario(page, LOCAL);
  await expect(page.getByText("Honduras 5200, Palermo")).toBeVisible();
  await expect(page.getByText("En tu local. Avisamos a la gente que está cerca.")).toBeVisible();

  await completarLoDemas(page);
  await expect(publicar(page)).toBeEnabled();
  await publicar(page).click();

  await expect(page.getByText("¡Evento publicado!")).toBeVisible();
  expect(publicados).toHaveLength(1);
  expect(publicados[0]).toMatchObject({ city: "Palermo", latitude: -34.5875, longitude: -58.43 });
});

test("con local cargado: se puede cambiar la zona y se publica la elegida", async ({ page }) => {
  const publicados = await abrirFormulario(page, LOCAL);
  await expect(page.getByText("Honduras 5200, Palermo")).toBeVisible();
  await page.getByRole("button", { name: "Cambiar" }).click();

  await page.getByLabel("Barrio").selectOption("Almagro");
  await completarLoDemas(page);
  await publicar(page).click();

  await expect(page.getByText("¡Evento publicado!")).toBeVisible();
  expect(publicados[0]).toMatchObject({ city: "Almagro, CABA", latitude: -34.6106, longitude: -58.4214 });
});

test("sin local cargado: pide elegir zona, no publica hasta tenerla y ofrece cargar el local", async ({
  page,
}) => {
  const publicados = await abrirFormulario(page, null);
  await completarLoDemas(page);

  // Todo lo demás está completo y aun así no se puede publicar: falta la zona.
  await expect(page.getByText("Elegí la zona del evento para poder publicar.")).toBeVisible();
  await expect(publicar(page)).toBeDisabled();
  await expect(page.getByRole("link", { name: "Cargar mi local" })).toHaveAttribute(
    "href",
    "/profile/edit"
  );
  // Pedir la zona no es un error: no hay mensaje de falla.
  await expect(page.getByText(/no se pudo|error/i)).toHaveCount(0);

  await page.getByLabel("Barrio").selectOption("Palermo");
  await expect(publicar(page)).toBeEnabled();
  await expect(page.getByText("Elegí la zona del evento para poder publicar.")).toHaveCount(0);
  await publicar(page).click();

  await expect(page.getByText("¡Evento publicado!")).toBeVisible();
  expect(publicados[0].city).toBe("Palermo, CABA");
  expect(publicados[0].latitude).not.toBeNull();
  expect(publicados[0].longitude).not.toBeNull();
});

test("local sin coordenadas: se trata como sin zona", async ({ page }) => {
  await abrirFormulario(page, { ...LOCAL, latitude: null, longitude: null });
  await completarLoDemas(page);
  await expect(publicar(page)).toBeDisabled();
  await expect(page.getByText("Elegí la zona del evento para poder publicar.")).toBeVisible();
});

test("local con punto en el mapa pero sin ciudad: se trata como sin zona y 'Cambiar' no deja publicar", async ({
  page,
}) => {
  const publicados = await abrirFormulario(page, { ...LOCAL, city: null });
  await completarLoDemas(page);
  // No se publica un evento que el panel mostraría como «Ubicación a confirmar».
  await expect(publicar(page)).toBeDisabled();
  await expect(page.getByText("Elegí la zona del evento para poder publicar.")).toBeVisible();

  await page.getByLabel("Barrio").selectOption("Palermo");
  await publicar(page).click();
  await expect(page.getByText("¡Evento publicado!")).toBeVisible();
  expect(publicados[0].city).toBe("Palermo, CABA");
});

test("con local: tras 'Cambiar' y sin elegir zona, el botón queda deshabilitado", async ({ page }) => {
  await abrirFormulario(page, LOCAL);
  await page.getByRole("button", { name: "Cambiar" }).click();
  await completarLoDemas(page);
  await expect(page.getByText("Elegí la zona del evento para poder publicar.")).toBeVisible();
  await expect(publicar(page)).toBeDisabled();
});

test("si el servidor rechaza por falta de zona, el cartel dice por qué", async ({ page }) => {
  await abrirFormulario(page, LOCAL);
  await page.route("**/api/v1/shifts/events", (route) =>
    route.fulfill({
      status: 422,
      contentType: "application/json",
      body: JSON.stringify({
        detail: [{ type: "zona_requerida", loc: ["body"], msg: "Elegí la zona del evento: sin eso no avisamos." }],
      }),
    })
  );
  await completarLoDemas(page);
  await publicar(page).click();
  await expect(page.getByText("Elegí la zona del evento: sin eso no avisamos.")).toBeVisible();
  await expect(page.getByText("Error inesperado")).toHaveCount(0);
});
