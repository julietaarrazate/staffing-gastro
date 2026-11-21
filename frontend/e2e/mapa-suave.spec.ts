import { test, expect, type Page } from "@playwright/test";
import { deContrato, opcionesDeContrato } from "./contrato";
import { blockExternalHosts, injectSession, isoEnDias, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

/**
 * El Mapa de quien trabaja con la dirección suave (ADR-0028, 2026-11-20,
 * docs/historial/2026-11-20-mapa-direccion-suave.md, maqueta `T-Mapa`): el
 * mapa se funde arriba con el cielo y lleva el título encima; el pago va en
 * el pin y el elegido en azul hondo; los turnos son filas suaves en la hoja
 * (celular) o en el panel (compu), con la foto del local o el cielo en lugar
 * del cuadradito de color por rubro, y un solo ámbar: «Postularme» del turno
 * elegido. Las acciones y los gestos son los de siempre. Se mide renderizado,
 * en claro y de noche.
 */
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

const turno = (id: string, position: string, company: string, lat: number, lng: number, extra: Record<string, unknown> = {}) => ({
  id,
  company_id: `c-${id}`,
  position,
  company_name: company,
  latitude: lat,
  longitude: lng,
  start_at: isoEnDias(1, "20:00"),
  end_at: isoEnDias(2, "02:00"),
  pay_amount: "54000.00",
  ...extra,
});
// La persona está en Palermo; el bar queda a un par de cuadras y el café un poco más lejos.
const BAR = turno("bar", "bartender", "Bar Mirasol", -34.5885, -58.4262, { urgent: true, tips: true });
const CAFE = turno("cafe", "mozo", "Café Thames", -34.5845, -58.4335, { pay_amount: "45000.00", pay_band: "por_encima" });
const FEED = () => [...deContrato("feed", [BAR]), ...deContrato("feed", [CAFE])];

test.use({ geolocation: { latitude: -34.5895, longitude: -58.4285 }, permissions: ["geolocation"] });

async function mapa(page: Page, theme: "light" | "dark") {
  await setTheme(page, theme);
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  // Catch-all primero: Playwright resuelve la última ruta registrada.
  await page.route("**/api/v1/**", (r) => (r.request().method() === "GET" ? r.fulfill(json([])) : r.continue()));
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(opcionesDeContrato("auth_me_worker")));
  await page.route("**/api/v1/shifts/feed", (r) => r.fulfill(json(FEED())));
  await page.goto("/map");
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await expect(page.getByRole("button", { name: /^Turno de Bartender/ })).toBeVisible({ timeout: 20_000 });
}

const AMBAR = /rgb\(246, 169, 42\)/;
/** Cuántos botones a la vista llevan el ámbar de la acción principal. */
const ambares = (page: Page) =>
  page.locator("button:visible").evaluateAll((els) => els.filter((el) => /rgb\(246, 169, 42\)/.test(getComputedStyle(el).backgroundImage)).length);

for (const theme of ["light", "dark"] as const) {
  test(`${theme}, celular: el título va sobre el cielo, el pin elegido en azul hondo y la hoja con filas suaves y un solo ámbar`, async ({ page }) => {
    await mapa(page, theme);

    // El título, en letra normal, sobre el cielo que se funde con el mapa. No tapa los gestos.
    const titulo = page.getByRole("heading", { level: 1, name: "2 turnos cerca tuyo" });
    await expect(titulo).toHaveClass(/titulo-pantalla/);
    const cielo = titulo.locator("xpath=..");
    await expect(cielo).toHaveClass(/mapa-cielo/);
    await expect(cielo).toHaveCSS("pointer-events", "none");
    // El cielo va detrás del mapa y lo que se esfuma es el lienzo: debajo del
    // título (un velo corto: menos de 40 px bajo el título) nada tapa los pines.
    // Se mide bajo el título y no la altura total: con el conmutador «Lista /
    // Mapa» flotando a su derecha el título pasa a dos renglones (~118 px).
    const cajaCielo = (await cielo.boundingBox())!;
    const cajaTitulo = (await titulo.boundingBox())!;
    expect(cajaCielo.y + cajaCielo.height - (cajaTitulo.y + cajaTitulo.height)).toBeLessThan(40);
    await expect(page.locator(".maplibregl-map").first()).toHaveCSS("background-image", /linear-gradient/);
    await expect(page.locator(".maplibregl-canvas").first()).toHaveCSS("mask-image", /linear-gradient/);

    // El pago en el pin; el elegido (el más cercano), en azul hondo con letra blanca y más grande.
    const elegido = page.getByRole("button", { name: /^Turno de Bartender, \$\s?54\.000/ });
    const otro = page.getByRole("button", { name: /^Turno de Mozo\/a, \$\s?45\.000, paga por encima de lo habitual/ });
    await expect(elegido).toHaveAttribute("aria-pressed", "true");
    await expect(elegido).toHaveCSS("background-image", /rgb\(42, 115, 163\)/);
    await expect(elegido).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(otro).toHaveAttribute("aria-pressed", "false");
    await expect(otro).toHaveCSS("background-image", "none");
    await expect(otro).toHaveCSS("background-color", theme === "light" ? "rgb(255, 255, 255)" : "rgb(29, 40, 51)");
    const [altoElegido, altoOtro] = await Promise.all([elegido, otro].map((p) => p.evaluate((el) => el.getBoundingClientRect().height)));
    expect(altoElegido).toBeGreaterThan(altoOtro);
    // Sin ámbar en el mapa: ni el pin, ni el punto de «estás acá».
    await expect(page.locator(".puck-punto")).toHaveCSS("background-color", "rgb(42, 115, 163)");

    // La hoja: filas suaves, con el cielo donde no hay foto (no el cuadradito de color por rubro).
    const filas = page.locator(".mapa-hoja .mapa-turno");
    await expect(filas).toHaveCount(2);
    const bar = filas.filter({ hasText: "Bar Mirasol" });
    await expect(bar).toHaveCSS("border-left-width", "0px");
    await expect(bar.locator('[data-portada="mini"]')).toBeVisible();
    await expect(bar.getByText("Urgente", { exact: true })).toHaveClass(/chip-urgente/);
    // El pago es lo más grande de la fila.
    const [tamPago, tamPuesto] = await Promise.all([
      bar.getByTestId("mapa-pago").evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
      bar.getByRole("heading", { level: 3 }).evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    ]);
    expect(tamPago).toBeGreaterThan(tamPuesto);

    // Un solo ámbar: «Postularme» del turno elegido. El del otro va quieto.
    await expect(bar.getByRole("button", { name: "Postularme" })).toHaveCSS("background-image", AMBAR);
    await expect(filas.filter({ hasText: "Café Thames" }).getByRole("button", { name: "Postularme" })).toHaveClass(/boton-quieto/);
    expect(await ambares(page)).toBe(1);
    // Lo que se toca mide 44 px o más.
    for (const boton of await page.locator(".mapa-hoja button:visible").all()) {
      const caja = await boton.boundingBox();
      if (caja && (await boton.getAttribute("aria-label"))?.startsWith("Arrastrá") !== true) expect(caja.height).toBeGreaterThanOrEqual(44);
    }
    // La pantalla no se desborda de costado.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test(`${theme}, celular: tocar otro pin lo elige (azul hondo) y le pasa el ámbar a su fila; tocar la fila abre el detalle con el pago grande`, async ({ page }) => {
    await mapa(page, theme);
    const pinCafe = page.getByRole("button", { name: /^Turno de Mozo\/a/ });
    await pinCafe.click();
    await expect(pinCafe).toHaveAttribute("aria-pressed", "true");
    await expect(pinCafe).toHaveCSS("background-image", /rgb\(42, 115, 163\)/);
    // (La cámara vuela al elegido y el otro pin puede salir de cuadro: no se afirma sobre él.)
    const filas = page.locator(".mapa-hoja .mapa-turno");
    await expect(filas.filter({ hasText: "Café Thames" }).getByRole("button", { name: "Postularme" })).toHaveCSS("background-image", AMBAR);
    await expect(filas.filter({ hasText: "Bar Mirasol" }).getByRole("button", { name: "Postularme" })).toHaveClass(/boton-quieto/);

    // Tocar la fila abre el detalle (no postula).
    await filas.filter({ hasText: "Café Thames" }).getByRole("heading", { level: 3 }).click();
    const detalle = page.getByRole("dialog");
    await expect(detalle).toBeVisible();
    const pago = detalle.locator(".turno-pago");
    await expect(pago).toContainText("45.000");
    await expect(detalle.getByText("Pago ofrecido")).toBeVisible();
    // Sin el módulo negro del pago ni su ícono ámbar: el único ámbar del detalle es «Postularme».
    await expect(detalle.locator(".bg-night")).toHaveCount(0);
    await expect(detalle.getByRole("button", { name: "Postularme" })).toHaveCSS("background-image", AMBAR);
  });

  test(`${theme}, compu: el panel es la lista con filas suaves, la elegida con su aro azul y el único ámbar; la fila lleva al turno`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mapa(page, theme);
    await expect(page.getByRole("heading", { level: 1, name: "2 turnos cerca tuyo" })).toHaveClass(/titulo-pantalla/);
    const filas = page.locator(".mapa-panel .mapa-turno");
    await expect(filas).toHaveCount(2);
    const bar = filas.filter({ hasText: "Bar Mirasol" });
    const cafe = filas.filter({ hasText: "Café Thames" });
    await expect(bar).toHaveAttribute("data-elegido", "true");
    await expect(bar).toHaveCSS("box-shadow", theme === "light" ? /rgb\(42, 115, 163\)/ : /rgb\(95, 163, 207\)/);
    await expect(bar.getByRole("button", { name: "Postularme" })).toHaveCSS("background-image", AMBAR);
    await expect(cafe.getByRole("button", { name: "Postularme" })).toHaveClass(/boton-quieto/);
    expect(await ambares(page)).toBe(1);
    await expect(bar.getByTestId("map-row-link")).toHaveAttribute("href", "/turno/bar");
    // Pasar el mouse por otra fila la elige: el aro, el ámbar y el pin en azul hondo se mudan.
    await cafe.hover();
    await expect(cafe).toHaveAttribute("data-elegido", "true");
    await expect(cafe.getByRole("button", { name: "Postularme" })).toHaveCSS("background-image", AMBAR);
    await expect(page.getByRole("button", { name: /^Turno de Mozo\/a/ })).toHaveAttribute("aria-pressed", "true");
    expect(await ambares(page)).toBe(1);
  });
}

test("de noche el mapa base se apaga (sólo el lienzo, no los pines); de día no lleva filtro", async ({ page }) => {
  await mapa(page, "dark");
  await expect(page.locator(".maplibregl-canvas").first()).toHaveCSS("filter", /invert/);
  await expect(page.getByRole("button", { name: /^Turno de Bartender/ })).toHaveCSS("filter", "none");
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  await expect(page.locator(".maplibregl-canvas").first()).toHaveCSS("filter", "none");
});

test("sin turnos, en el celular el aviso es una tarjeta baja que deja ver el mapa, con sus dos acciones", async ({ page }) => {
  await setTheme(page, "light");
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await page.route("**/api/v1/**", (r) => (r.request().method() === "GET" ? r.fulfill(json([])) : r.continue()));
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(opcionesDeContrato("auth_me_worker")));
  await page.goto("/map");
  const vacio = page.getByTestId("mapa-vacio");
  await expect(vacio.getByRole("heading", { level: 2, name: "No hay turnos cerca" })).toBeVisible();
  // Antes medía unos 370 px (la mitad de la pantalla); ahora, menos de 200.
  expect((await vacio.boundingBox())?.height).toBeLessThan(200);
  for (const name of ["Actualizar", "Ver todos en Buscar"]) {
    const caja = await vacio.getByRole("button", { name }).boundingBox();
    expect(caja?.height).toBeGreaterThanOrEqual(44);
  }
  expect(await ambares(page)).toBe(1);
});
