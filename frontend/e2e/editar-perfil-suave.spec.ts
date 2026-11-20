import { test, expect, type Page } from "@playwright/test";
import { deContrato, opcionesDeContrato } from "./contrato";
import { blockExternalHosts, injectSession, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

/**
 * «Editar perfil», «Datos del comercio» y «Ajustes» con la dirección suave
 * (ADR-0028, 2026-11-20, docs/historial/2026-11-20-editar-perfil-y-ajustes-direccion-suave.md):
 * el cielo corto con la vuelta al perfil en un botón de vidrio y el título en
 * letra normal; debajo, la hoja con el formulario o las filas. Las habilidades
 * y la apariencia elegidas van en azul hondo: el único ámbar es «Guardar
 * cambios». Qué se carga, qué se guarda y a dónde lleva cada cosa no cambia.
 */
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const AMBAR = /rgb\(246, 169, 42\)/;
const HONDO = /rgb\(42, 115, 163\)/;
const ambares = (page: Page) =>
  page.locator("button:visible, a:visible").evaluateAll(
    (els) => els.filter((el) => /rgb\(246, 169, 42\)/.test(getComputedStyle(el).backgroundImage) || getComputedStyle(el).backgroundColor === "rgb(217, 119, 6)").length,
  );

async function abrir(page: Page, theme: "light" | "dark", rol: "worker" | "employer", ruta: string) {
  await setTheme(page, theme);
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await page.route("**/api/v1/**", (r) => (r.request().method() === "GET" ? r.fulfill(json([])) : r.continue()));
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(opcionesDeContrato(rol === "worker" ? "auth_me_worker" : "auth_me_employer")));
  await page.route("**/api/v1/workers/me/profile", (r) =>
    r.fulfill(json(deContrato("perfil_trabajador", { skills: ["bartender", "cajero"], city: "Retiro, CABA" }))),
  );
  await page.route("**/api/v1/companies/me**", (r) => r.fulfill(opcionesDeContrato("perfil_comercio")));
  await page.goto(ruta);
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

async function cieloYHoja(page: Page, titulo: string) {
  const h1 = page.getByRole("heading", { level: 1, name: titulo });
  await expect(h1).toHaveClass(/titulo-pantalla/);
  await expect(h1.locator("xpath=..")).toHaveClass(/app-cielo/);
  await expect(page.locator(".estilo-suave .hoja")).toBeVisible();
  const volver = page.getByRole("link", { name: "Volver al perfil" });
  await expect(volver).toHaveClass(/boton-vidrio/);
  await expect(volver).toHaveAttribute("href", "/profile");
  expect((await volver.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

for (const theme of ["light", "dark"] as const) {
  test(`${theme}: Editar perfil va sobre el cielo y la hoja, las habilidades elegidas en azul hondo y un solo ámbar`, async ({ page }) => {
    await abrir(page, theme, "worker", "/profile/edit");
    await cieloYHoja(page, "Editar perfil");
    const habilidades = page.getByRole("group", { name: "Habilidades" });
    const elegida = habilidades.getByRole("button", { name: "Bartender" });
    const otra = habilidades.getByRole("button", { name: "Mozo/a" });
    await expect(elegida).toHaveAttribute("aria-pressed", "true");
    await expect(elegida).toHaveCSS("background-image", HONDO);
    await expect(elegida).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(otra).toHaveAttribute("aria-pressed", "false");
    await expect(otra).toHaveCSS("background-image", "none");
    expect((await otra.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    // Tocar una la elige (y se puede sacar): la lógica es la de siempre.
    await otra.click();
    await expect(otra).toHaveAttribute("aria-pressed", "true");
    await expect(otra).toHaveCSS("background-image", HONDO);
    // Los campos, con relleno y sin filete; el único ámbar es «Guardar cambios».
    await expect(page.getByLabel("Sobre mí")).toHaveClass(/campo/);
    await expect(page.getByLabel("Provincia")).toHaveClass(/campo/);
    await expect(page.getByRole("button", { name: "Guardar cambios" })).toHaveCSS("background-image", AMBAR);
    expect(await ambares(page)).toBe(1);
  });

  test(`${theme}: Ajustes va sobre el cielo y la hoja, con la apariencia elegida en azul hondo y la cuenta en filas suaves`, async ({ page }) => {
    await abrir(page, theme, "worker", "/profile/settings");
    await cieloYHoja(page, "Ajustes");
    const apariencia = page.getByRole("radiogroup", { name: "Apariencia" });
    const elegida = apariencia.getByRole("radio", { checked: true });
    await expect(elegida).toHaveCSS("background-image", HONDO);
    await expect(elegida).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(page.locator(".perfil-filas").getByRole("link", { name: "Soporte" })).toHaveAttribute("href", "/support");
    await expect(page.locator(".perfil-filas").getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
    // Sin ámbar en esta pantalla: no hay una acción principal.
    expect(await ambares(page)).toBe(0);
  });
}

test("Datos del comercio usa la misma cáscara y el formulario sigue guardando con su botón", async ({ page }) => {
  await abrir(page, "light", "employer", "/profile/edit");
  await cieloYHoja(page, "Datos del comercio");
  await expect(page.getByRole("button", { name: "Guardar cambios" })).toHaveCSS("background-image", AMBAR);
});

test("cambiar la apariencia desde Ajustes sigue cambiando el tema", async ({ page }) => {
  await abrir(page, "light", "worker", "/profile/settings");
  await page.getByRole("radio", { name: "Oscuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("radio", { name: "Oscuro" })).toHaveCSS("background-image", HONDO);
});
