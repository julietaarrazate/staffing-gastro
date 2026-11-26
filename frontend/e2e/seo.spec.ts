import { test, expect } from "@playwright/test";

/**
 * SEO y GEO (etapa 6, 2026-11-26): lo que buscadores y asistentes leen sin
 * sesión. La oferta de trabajo de `/turno/[id]` se arma en el servidor y se
 * prueba en `lib/seo.test.ts`.
 */
test("robots.txt deja afuera las pantallas de la app y apunta al mapa del sitio", async ({ request }) => {
  const texto = await (await request.get("/robots.txt")).text();
  for (const ruta of ["/shifts", "/support", "/favorites", "/buscar", "/admin", "/my-shifts"]) {
    expect(texto).toContain(`Disallow: ${ruta}`);
  }
  // Las páginas públicas de turno siguen abiertas.
  expect(texto).not.toContain("Disallow: /turno");
  expect(texto).toContain("Sitemap: https://www.oido.com.ar/sitemap.xml");
});

test("el mapa del sitio no inventa una fecha de cambio en cada pedido", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  expect(xml).toContain("<loc>https://www.oido.com.ar/terminos</loc>");
  expect(xml).not.toContain("<lastmod>");
});

test("llms.txt dice qué es Oído y que no es el empleador", async ({ request }) => {
  const respuesta = await request.get("/llms.txt");
  expect(respuesta.status()).toBe(200);
  const texto = await respuesta.text();
  expect(texto).toMatch(/^# Oído/);
  expect(texto).toContain("No es empleador");
  expect(texto).toContain("Ciudad de Buenos Aires");
});

for (const [ruta, titulo] of [
  ["/terminos", "Términos y Condiciones — Oído"],
  ["/privacidad", "Política de Privacidad — Oído"],
  ["/login", "Ingresar — Oído"],
  ["/register", "Crear cuenta — Oído"],
] as const) {
  test(`${ruta} tiene título y dirección canónica propios`, async ({ page }) => {
    await page.goto(ruta);
    await expect(page).toHaveTitle(titulo);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `https://www.oido.com.ar${ruta}`
    );
    // Ya no se declara como la portada.
    await expect(page.locator('meta[property="og:url"]')).toHaveCount(0);
  });
}

test("la portada sigue declarando su dirección y el idioma es español de Argentina", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://www.oido.com.ar");
  await expect(page.locator("html")).toHaveAttribute("lang", "es-AR");
});
