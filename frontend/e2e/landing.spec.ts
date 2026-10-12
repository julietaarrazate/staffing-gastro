import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, setTheme, skipSplash } from "./mocks";

/**
 * La landing corta (components/landing/). Lo que se fija acá es lo que tiene
 * que valer siempre: qué es y para quién arriba de todo, que los botones
 * lleven al alta correcta, que los títulos no terminen en punto, que los
 * precios estén aunque el backend no conteste, que las preguntas frecuentes
 * vayan también en datos estructurados, que no haya scroll horizontal a
 * 390px y que con "reducir movimiento" esté todo a la vista.
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

/** Baja la página entera a pasos (como un dedo), para que cada bloque
 *  dispare su entrada. */
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
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /¿Faltó alguien de tu equipo\?\s*Cubrí el turno en minutos/
  );
  const hero = page.locator("#hero-ctas");
  await expect(hero.getByRole("link", { name: "Publicar un turno gratis" })).toHaveAttribute(
    "href",
    "/register?rol=comercio"
  );
  await expect(hero.getByRole("link", { name: /¿Trabajás en gastronomía\?/ })).toHaveAttribute(
    "href",
    "/register?rol=trabajador"
  );
  // Sin eyebrow ni bajada (Julieta, 2026-10-12).
  await expect(page.getByText(/Beta en CABA/)).toHaveCount(0);
  // El Navbar de la app no se muestra en "/" sin sesión: la landing trae el suyo.
  await expect(page.getByRole("link", { name: "Ingresar" }).first()).toBeVisible();
});

test("ningún título termina en punto y los pasos son h3", async ({ page }) => {
  await sinSesion(page);
  await page.goto("/");
  const titulos = await page
    .locator("[data-landing] :is(h1, h2, h3)")
    .evaluateAll((els) => els.map((el) => (el.textContent ?? "").trim()));
  expect(titulos.length).toBeGreaterThan(6);
  expect(titulos.filter((t) => t.endsWith("."))).toEqual([]);
  await expect(page.getByRole("heading", { level: 3, name: "Contalo como lo dirías" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Le llega a quien está cerca" })).toBeAttached();
  await expect(page.getByRole("heading", { level: 3, name: "Elegís y te confirma" })).toBeAttached();
  // Las tarjetas de ejemplo no suman títulos ni links a perfiles inventados.
  await expect(page.locator('[data-landing] a[href^="/workers/"], [data-landing] a[href^="/companies/"]')).toHaveCount(0);
});

test("el encabezado lleva a la sección de quien trabaja y muestra el botón al pasar el hero", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await sinSesion(page);
  await page.goto("/");
  const pedir = page.locator("header").getByRole("link", { name: "Pedir personal" });
  await expect(pedir).toHaveCount(0); // escondido: fuera del árbol accesible
  await page.locator("header").getByRole("link", { name: "Para trabajar" }).click();
  await expect(page).toHaveURL(/#trabajar$/);
  await expect(page.getByRole("heading", { level: 2, name: /Turnos de gastronomía cerca tuyo/ })).toBeInViewport();
  await expect(page.locator("header").getByRole("link", { name: "Pedir personal" })).toHaveAttribute(
    "href",
    "/register?rol=comercio"
  );
  await expect(page.locator("#trabajar").getByRole("link", { name: "Crear mi perfil gratis" })).toHaveAttribute(
    "href",
    "/register?rol=trabajador"
  );
});

test("las preguntas frecuentes también van como datos estructurados", async ({ page }) => {
  await sinSesion(page);
  await page.goto("/");
  const datos = await page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((els) => els.map((el) => JSON.parse(el.textContent ?? "null")).flat());
  const faq = datos.find((d) => d?.["@type"] === "FAQPage");
  const visibles = await page.locator("#preguntas summary").allTextContents();
  expect(faq.mainEntity.map((q: { name: string }) => q.name)).toEqual(visibles.map((t) => t.trim()));
  expect(datos.some((d) => d?.["@type"] === "Organization")).toBe(true);
  // Se abre sin JavaScript (details/summary).
  await page.getByText("¿Qué pasa si no viene?").click();
  await expect(page.getByText(/elegís a otra persona de las que se postularon/)).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /oido\.com\.ar\/?$/);
});

test("se recorre entera sin errores ni scroll horizontal a 390px", async ({ page }) => {
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
  await expect(precios.getByRole("link", { name: "Publicar un turno gratis" })).toHaveAttribute(
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
  // La paleta celeste en previsualización cambia sólo lo que era violeta:
  // el lienzo sigue en #f3f3f3.
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const fondo = await page
    .locator("[data-landing]")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(fondo).toBe("rgb(243, 243, 243)");
});

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";

test.describe("instalar en iPhone", () => {
  test.use({ userAgent: IPHONE_UA, viewport: { width: 390, height: 844 }, hasTouch: true });

  test("muestra los dos caminos, primero Safari: Compartir y Agregar a inicio", async ({ page }) => {
    await sinSesion(page);
    await page.goto("/");
    const titulos = page.locator("#instalar h3");
    await expect(titulos).toHaveText(["iPhone · desde Safari", "Android · desde Chrome"]);
    await expect(page.locator("#instalar")).toContainText("Agregar a inicio");
  });
});

test.describe("instalar en Android", () => {
  test.use({ userAgent: ANDROID_UA, viewport: { width: 390, height: 844 }, hasTouch: true });

  test("con el aviso del navegador, el botón instala directo", async ({ page }) => {
    await sinSesion(page);
    // El navegador avisa que se puede instalar (lo simulamos antes de cargar).
    await page.addInitScript(() => {
      window.addEventListener("load", () => {
        const e = new Event("beforeinstallprompt") as Event & Record<string, unknown>;
        e.prompt = async () => {
          (window as unknown as { __prompted: boolean }).__prompted = true;
        };
        e.userChoice = Promise.resolve({ outcome: "accepted" });
        window.dispatchEvent(e);
      });
    });
    await page.goto("/");
    const boton = page.locator("#instalar").getByRole("button", { name: "Instalar Oído" });
    await boton.click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __prompted?: boolean }).__prompted)).toBe(true);
    // Instalada, la sección ya no se ofrece.
    await expect(page.locator("#instalar")).toHaveCount(0);
  });

  test("la barra de abajo aparece al pasar el botón del inicio", async ({ page }) => {
    await sinSesion(page);
    await page.goto("/");
    const barra = page.getByRole("link", { name: "Publicar un turno gratis" }).and(page.locator('[data-cta="barra"]'));
    await expect(barra).not.toBeInViewport();
    await page.evaluate(() => window.scrollTo(0, 1600));
    await expect(barra).toBeInViewport();
    await expect(page.locator('[data-cta="barra-instalar"]')).toHaveAttribute("href", "/#instalar");
  });
});

test("abierta desde el ícono instalado y sin sesión, va a ingresar", async ({ page }) => {
  await sinSesion(page);
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (q: string) =>
      q === "(display-mode: standalone)" ? ({ ...original(q), matches: true } as MediaQueryList) : original(q);
  });
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test.describe("con reducir movimiento", () => {
  test.use({ reducedMotion: "reduce" });

  test("todo está a la vista desde el principio, sin nada fijado al scroll", async ({ page }) => {
    await sinSesion(page);
    await page.goto("/");
    await expect(page.getByText("Perdón, hoy no llego.")).toBeVisible();
    await expect(page.getByText("Lucía confirmó tu turno de las 21")).toBeVisible();
    // Ningún bloque queda esperando su entrada.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(page.locator('[data-reveal="pending"]')).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "¡Oído!" })).toBeAttached();
    // Ninguna sección queda fijada (el único `sticky` es el encabezado).
    const sticky = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll("[data-landing] section *")).filter(
          (el) => getComputedStyle(el).position === "sticky"
        ).length
    );
    expect(sticky).toBe(0);
  });
});

test("la historia de un turno sigue en /historia, fuera de los buscadores", async ({ page }) => {
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(String(e)));
  await sinSesion(page);
  await page.goto("/historia");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Personal gastronómico,\s*ya\./);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await page.waitForTimeout(600);
  await recorrer(page);
  await expect(page.getByText("¡Oído!").first()).toBeAttached();
  expect(errores).toEqual([]);
});
