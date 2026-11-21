import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, setTheme, skipSplash } from "./mocks";
import { deContrato } from "./contrato";

/**
 * La barra flotante, el encabezado y el «+» de «Publicar turno» (Julieta,
 * 2026-11-20; docs/historial/2026-11-20-barra-flotante-y-encabezado.md):
 *
 * - en el celular, quien trabaja y el comercio no tienen encabezado: «oído» y
 *   la campanita van sobre el cielo del Inicio y del Panel, y en las demás
 *   pantallas la cuenta de avisos sin leer va sobre esa pestaña de la barra;
 * - la barra de abajo es una píldora separada de los bordes, y el comercio
 *   tiene al lado el «+» de «Publicar turno»;
 * - en la compu la barra es la de arriba, con la campanita en todas las
 *   pantallas y «Publicar turno» al lado para el comercio.
 *
 * Se mide con la pantalla renderizada, en claro y de noche.
 */
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const WORKER = { id: "u", email: "w@oido.test", full_name: "Sofía Demo", role: "worker", status: "activo", is_active: true, is_verified: true };
const EMPLOYER = { ...WORKER, id: "u-e", email: "e@oido.test", full_name: "Julieta Demo", role: "employer" };

async function abrir(page: Page, quien: "worker" | "employer", ruta: string, tema: "light" | "dark" = "light") {
  await setTheme(page, tema);
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  // Catch-all primero: Playwright resuelve la última ruta registrada.
  await page.route("**/api/v1/**", (r) => (r.request().method() === "GET" ? r.fulfill(json([])) : r.continue()));
  await page.route("**/api/v1/notifications", (r) =>
    r.fulfill(json(deContrato("avisos_trabajador", [{ id: "notification-3" }, { id: "notification-4" }])))
  );
  await page.route("**/api/v1/notifications/*/read", (r) => r.fulfill(json({})));
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json(quien === "worker" ? WORKER : EMPLOYER)));
  await page.route("**/api/v1/workers/me/profile", (r) =>
    r.fulfill(json(deContrato("perfil_trabajador", { city: "Palermo, CABA", skills: ["mozo"] })))
  );
  await page.goto(ruta);
  await expect(page.locator("html")).toHaveAttribute("data-theme", tema);
}

const barra = (page: Page) => page.getByRole("navigation", { name: "Secciones" });

for (const tema of ["light", "dark"] as const) {
  test(`celular (${tema}): la barra flota, separada de los bordes, y la activa lleva su óvalo`, async ({ page }) => {
    await abrir(page, "worker", "/buscar", tema);
    const caja = await barra(page).boundingBox();
    expect(caja).not.toBeNull();
    expect(caja!.x).toBeGreaterThanOrEqual(12);
    expect(390 - (caja!.x + caja!.width)).toBeGreaterThanOrEqual(12);
    expect(844 - (caja!.y + caja!.height)).toBeGreaterThanOrEqual(12);

    const activa = barra(page).getByRole("link", { name: "Buscar" });
    await expect(activa).toHaveAttribute("aria-current", "page");
    const [ovalo, otra] = await Promise.all(
      ["Buscar", "Mapa"].map((nombre) =>
        barra(page)
          .getByRole("link", { name: nombre })
          .locator(".barra-app-icono")
          .evaluate((el) => getComputedStyle(el).backgroundColor)
      )
    );
    expect(ovalo).not.toBe(otra);
  });
}

test("celular: sin encabezado; fuera del Inicio la cuenta de avisos va en su pestaña y la campanita está en el cielo del Inicio", async ({
  page,
}) => {
  await abrir(page, "worker", "/buscar");
  await expect(page.getByRole("banner")).toBeHidden();
  await expect(page.getByRole("button", { name: "Notificaciones" })).toBeHidden();
  const inicio = barra(page).getByRole("link", { name: "Inicio, 2 avisos sin leer" });
  await expect(inicio).toBeVisible();

  await inicio.click();
  await expect(page).toHaveURL(/\/feed$/);
  // En el Inicio la cuenta está en la campanita, no repetida en la pestaña.
  await expect(barra(page).getByRole("link", { name: "Inicio", exact: true })).toBeVisible();
  const campanita = page.getByTestId("inicio-cielo").getByRole("button", { name: "Notificaciones" });
  await expect(campanita).toContainText("2");

  await campanita.click();
  const hoja = page.getByRole("dialog", { name: "Notificaciones" });
  await expect(hoja.getByRole("button", { name: "Marcar todas como leídas" })).toBeVisible();
  // La hoja entra en la pantalla: no se sale por los costados.
  const caja = await hoja.boundingBox();
  expect(caja!.x).toBeGreaterThanOrEqual(0);
  expect(caja!.x + caja!.width).toBeLessThanOrEqual(390);
  await page.keyboard.press("Escape");
  await expect(hoja).toBeHidden();
});

test("celular, comercio: «oído» y la campanita sobre el cielo del Panel, y el «+» de «Publicar turno» al lado de la barra", async ({
  page,
}) => {
  await abrir(page, "employer", "/shifts");
  await expect(page.getByRole("banner")).toBeHidden();
  const cielo = page.getByTestId("panel-cielo");
  await expect(cielo.getByRole("img", { name: "Oído" })).toBeVisible();
  await expect(cielo.getByRole("button", { name: "Notificaciones" })).toBeVisible();

  const mas = page.locator(".barra-app").getByRole("link", { name: "Publicar turno" });
  const [cajaBarra, cajaMas] = await Promise.all([barra(page).boundingBox(), mas.boundingBox()]);
  // Al lado, no encima: el «+» arranca donde termina la píldora.
  expect(cajaMas!.x).toBeGreaterThanOrEqual(cajaBarra!.x + cajaBarra!.width);
  expect(cajaMas!.width).toBeGreaterThanOrEqual(48);

  await mas.click();
  await expect(page).toHaveURL(/\/shifts\/new$/);
  // Publicando, el «+» no va: ya se está en eso.
  await expect(page.locator(".barra-app").getByRole("link", { name: "Publicar turno" })).toHaveCount(0);
});

for (const tema of ["light", "dark"] as const) {
  test(`compu (${tema}): la barra es la de arriba, con la campanita en toda pantalla y «Publicar turno» para el comercio`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await abrir(page, "employer", "/search", tema);
    await expect(barra(page)).toBeHidden();
    const arriba = page.getByRole("banner");
    await expect(arriba.getByRole("link", { name: "Buscar" })).toHaveAttribute("aria-current", "page");
    await expect(arriba.getByRole("button", { name: "Notificaciones" })).toContainText("2");
    await arriba.getByRole("link", { name: "Publicar turno" }).click();
    await expect(page).toHaveURL(/\/shifts\/new$/);
  });
}

test("tablet (768 px): la barra de arriba del comercio entra entera", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await abrir(page, "employer", "/shifts");
  const arriba = page.getByRole("banner");
  for (const nombre of ["Panel", "Buscar", "Favoritos", "Mensajes", "Mi plan", "Mi comercio", "Publicar turno"]) {
    const caja = await arriba.getByRole("link", { name: nombre, exact: true }).boundingBox();
    expect(caja, nombre).not.toBeNull();
    expect(caja!.x, nombre).toBeGreaterThanOrEqual(0);
    expect(caja!.x + caja!.width, nombre).toBeLessThanOrEqual(768);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(768);
});
