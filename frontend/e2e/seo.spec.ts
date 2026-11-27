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

test("el mapa del sitio sale siempre con las páginas fijas y no inventa fechas de cambio para ellas", async ({ request }) => {
  // Los turnos abiertos los pide el servidor al backend; si no responde (acá,
  // sin API), sale igual con las fijas y nunca con un error.
  const respuesta = await request.get("/sitemap.xml");
  expect(respuesta.status()).toBe(200);
  const xml = await respuesta.text();
  for (const ruta of ["/", "/register", "/login", "/terminos", "/privacidad"]) {
    expect(xml).toContain(`<loc>https://www.oido.com.ar${ruta}</loc>`);
  }
  const entradas = xml.match(/<url>[\s\S]*?<\/url>/g) ?? [];
  for (const entrada of entradas) {
    // Sólo las páginas de turno llevan fecha (cuándo se publicó).
    if (!entrada.includes("/turno/")) expect(entrada).not.toContain("<lastmod>");
  }
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

test("la portada declara WebSite y Organization, y Oído no se presenta como agencia ni empleador", async ({ page }) => {
  await page.goto("/");
  const datos = await page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((els) => els.map((el) => JSON.parse(el.textContent ?? "null")).flat());
  const tipos = datos.map((d: { "@type": string }) => d["@type"]);
  expect(tipos).toEqual(expect.arrayContaining(["WebSite", "Organization", "FAQPage"]));
  const sitio = datos.find((d: { "@type": string }) => d["@type"] === "WebSite");
  expect(sitio.url).toBe("https://www.oido.com.ar");
  expect(sitio.description).toContain("no es una agencia de empleo ni el empleador");
});
