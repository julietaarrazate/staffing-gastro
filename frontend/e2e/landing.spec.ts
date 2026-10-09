import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, setTheme, skipSplash } from "./mocks";

/**
 * La landing es una historia fijada al scroll (components/landing/story/).
 * Lo que se fija acá no es la coreografía —eso se mira renderizado, en
 * capturas— sino lo que tiene que valer siempre: qué es y para quién arriba
 * de todo, que los botones lleven al alta correcta, que los precios estén
 * aunque el backend no conteste, que no haya scroll horizontal a 390px y que
 * con "reducir movimiento" se lea la misma historia sin animación.
 */

async function sinSesion(page: Page, planes?: { status: number; body?: unknown }) {
  await skipSplash(page);
  await blockExternalHosts(page);
  // Catch-all primero: Playwright resuelve las rutas al revés (gana la última).
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({ status: 404, contentType: "application/json", body: "{}" })
  );
  if (planes) {
    await page.route("**/api/v1/subscription/plans/public", (route) =>
      route.fulfill({
        status: planes.status,
        contentType: "application/json",
        body: JSON.stringify(planes.body ?? {}),
      })
    );
  }
}

/** Baja la página entera a pasos (como un dedo), para que cada escena fijada
 *  corra su progreso de 0 a 1. */
async function recorrer(page: Page) {
  const alto = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= alto; y += 400) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(20);
  }
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
}

test("arriba de todo dice qué es y para quién, con los dos caminos al alta", async ({ page }) => {
  await sinSesion(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Personal gastronómico,\s*ya\./);
  const hero = page.locator("#hero-ctas");
  await expect(hero.getByRole("link", { name: "Necesito personal" })).toHaveAttribute(
    "href",
    "/register?rol=comercio"
  );
  await expect(hero.getByRole("link", { name: "Quiero trabajar" })).toHaveAttribute(
    "href",
    "/register?rol=trabajador"
  );
  // El Navbar de la app no se muestra en "/" sin sesión: la landing trae el suyo.
  await expect(page.getByRole("link", { name: "Ingresar" }).first()).toBeVisible();
});

test("la historia se recorre entera sin errores ni scroll horizontal a 390px", async ({ page }) => {
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(String(e)));
  await sinSesion(page);
  await page.goto("/");
  await page.waitForTimeout(600);
  await recorrer(page);
  await expect(page.locator("[data-landing] footer")).toBeVisible();
  const { ancho, scroll } = await page.evaluate(() => ({
    ancho: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(ancho);
  expect(errores).toEqual([]);
});

test("los precios salen de la API cuando contesta", async ({ page }) => {
  await sinSesion(page, {
    status: 200,
    body: {
      plans: [
        { code: "gratis", name: "Gratis", price_ars: 0, max_turnos_mes: 3, features: ["Hasta 3 turnos publicados por mes"] },
        { code: "basico", name: "Básico", price_ars: 21500, max_turnos_mes: 15, features: ["Hasta 15 turnos publicados por mes"] },
        { code: "pro", name: "Pro", price_ars: 47000, max_turnos_mes: null, features: ["Turnos publicados ilimitados", "Destacado en el feed"] },
      ],
    },
  });
  await page.goto("/#precios");
  const precios = page.locator("#precios");
  await expect(precios).toContainText("$21.500");
  await expect(precios).toContainText("$47.000");
});

test("si la API de precios falla, la carta sigue estando (respaldo)", async ({ page }) => {
  await sinSesion(page, { status: 500 });
  await page.goto("/#precios");
  const precios = page.locator("#precios");
  await expect(precios).toContainText("$20.000");
  await expect(precios).toContainText("$45.000");
  await expect(precios.getByRole("link", { name: "Creá tu comercio gratis" })).toHaveAttribute(
    "href",
    "/register?rol=comercio"
  );
});

test("con el tema oscuro elegido, la landing mantiene su paleta propia", async ({ page }) => {
  await setTheme(page, "dark");
  await sinSesion(page);
  await page.goto("/");
  // La app sí se oscurece (data-theme="dark" en <html>); la landing fija la
  // suya, porque su contraste de tramos (noche, ámbar, marca) ya es el diseño.
  // Con la paleta celeste y naranja en previsualización, el lienzo es el
  // celeste claro #c4e3ed.
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const fondo = await page
    .locator("[data-landing]")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(fondo).toBe("rgb(196, 227, 237)");
});

test.describe("con reducir movimiento", () => {
  test.use({ reducedMotion: "reduce" });

  test("cada escena se lee como cuadros quietos, sin escenario fijado", async ({ page }) => {
    await sinSesion(page);
    await page.goto("/");
    await expect(page.getByText("Arrancás a las 21. Y te escribe el mozo.")).toBeVisible();
    await expect(page.getByText("Lo pedís en una frase.").first()).toBeAttached();
    await expect(page.getByText("¡Oído!").first()).toBeAttached();
    // Ninguna escena queda fijada (el único `sticky` es el encabezado).
    const sticky = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll("[data-landing] section *")).filter(
          (el) => getComputedStyle(el).position === "sticky"
        ).length
    );
    expect(sticky).toBe(0);
  });
});
