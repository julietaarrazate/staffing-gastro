import { test, expect, type Page } from "@playwright/test";
import { deContrato, opcionesDeContrato } from "./contrato";
import { blockExternalHosts, injectSession, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

/**
 * `/map` de quien trabaja (2026-11-21, docs/historial/2026-11-21-mapa-pines-y-chips.md):
 * el pin lleva el ícono del rubro antes del pago; con el mapa cerca (zoom 15 o
 * más) el nombre del local sale en una pastilla al lado del pin (y se voltea a
 * la izquierda si no entra); y bajo el título hay chips de vidrio («Hoy»,
 * «Mañana», «Fin de semana», «Paga más») que filtran en el cliente los pines,
 * la lista de la hoja y el título. El reloj va fijo: miércoles 18/11/2026,
 * 12:00 en Argentina.
 */
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const AHORA = new Date("2026-11-18T12:00:00-03:00");

const turno = (id: string, position: string, company: string, lat: number, lng: number, start: string, extra: Record<string, unknown> = {}) => ({
  id,
  company_id: `c-${id}`,
  position,
  company_name: company,
  latitude: lat,
  longitude: lng,
  start_at: `${start}-03:00`,
  end_at: `${start.slice(0, 10)}T23:59:00-03:00`,
  pay_amount: "50000.00",
  ...extra,
});
// La persona está en Palermo; los cinco turnos quedan a más de 450 m entre sí
// (a zoom 14 no se agrupan) y a menos de 2 km de ella.
const HOY = turno("hoy", "bartender", "Bar Mirasol", -34.5885, -58.4262, "2026-11-18T20:00:00", { urgent: true, pay_amount: "54000.00" });
const MANANA = turno("manana", "mozo", "Café Thames", -34.5845, -58.4335, "2026-11-19T09:00:00", { pay_amount: "45000.00", pay_band: "por_encima" });
const SABADO = turno("sabado", "cocinero", "Pizzería Güerrín", -34.595, -58.435, "2026-11-21T21:00:00", { pay_amount: "38000.00" });
const DOMINGO = turno("domingo", "barista", "Heladería Rapa", -34.599, -58.422, "2026-11-22T15:00:00", { pay_amount: "41000.00", pay_band: "por_encima" });
const LUNES = turno("lunes", "runner", "Cervecería Antares", -34.5845, -58.4215, "2026-11-23T10:00:00", { pay_amount: "30000.00" });
const feed = (ts: Record<string, unknown>[]) => ts.flatMap((t) => deContrato("feed", [t]));

test.use({ geolocation: { latitude: -34.5895, longitude: -58.4285 }, permissions: ["geolocation"] });

async function abrir(page: Page, theme: "light" | "dark", turnos = [HOY, MANANA, SABADO, DOMINGO, LUNES]) {
  await page.clock.install({ time: AHORA });
  await setTheme(page, theme);
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await page.route("**/api/v1/**", (r) => (r.request().method() === "GET" ? r.fulfill(json([])) : r.continue()));
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(opcionesDeContrato("auth_me_worker")));
  await page.route("**/api/v1/shifts/feed", (r) => r.fulfill(json(feed(turnos))));
  await page.goto("/map");
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await expect(page.getByRole("button", { name: /^Turno de / }).first()).toBeVisible({ timeout: 20_000 });
}

const pines = (page: Page) => page.getByRole("button", { name: /^Turno de / });
const tarjetas = (page: Page) => page.locator(".mapa-hoja .mapa-turno");
const chip = (page: Page, name: string) => page.locator(".mapa-cielo").getByRole("button", { name, exact: true });
const titulo = (page: Page) => page.getByRole("heading", { level: 1 }).first();
const sinScrollLateral = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

for (const theme of ["light", "dark"] as const) {
  test(`${theme}: los chips filtran los pines, la lista y el título, uno a la vez; «Paga más» se combina; «Quitar filtros»`, async ({ page }) => {
    await abrir(page, theme);
    await expect(titulo(page)).toHaveText("5 turnos cerca tuyo");
    await expect(pines(page)).toHaveCount(5);
    await expect(tarjetas(page)).toHaveCount(5);
    for (const n of ["Hoy", "Mañana", "Fin de semana", "Paga más"]) await expect(chip(page, n)).toHaveAttribute("aria-pressed", "false");

    // Hoy: sólo el bar de esta noche.
    await chip(page, "Hoy").click();
    await expect(chip(page, "Hoy")).toHaveAttribute("aria-pressed", "true");
    await expect(titulo(page)).toHaveText("1 turno cerca tuyo");
    await expect(pines(page)).toHaveCount(1);
    await expect(page.getByRole("button", { name: /^Turno de Bartender/ })).toBeVisible();
    await expect(tarjetas(page)).toHaveCount(1);
    await expect(tarjetas(page).first()).toContainText("Bar Mirasol");

    // Uno a la vez: Mañana suelta Hoy.
    await chip(page, "Mañana").click();
    await expect(chip(page, "Mañana")).toHaveAttribute("aria-pressed", "true");
    await expect(chip(page, "Hoy")).toHaveAttribute("aria-pressed", "false");
    await expect(titulo(page)).toHaveText("1 turno cerca tuyo");
    await expect(tarjetas(page).first()).toContainText("Café Thames");
    await expect(page.getByRole("button", { name: /^Turno de Mozo\/a/ })).toBeVisible();

    // Fin de semana: el sábado y el domingo (el lunes no).
    await chip(page, "Fin de semana").click();
    await expect(chip(page, "Mañana")).toHaveAttribute("aria-pressed", "false");
    await expect(titulo(page)).toHaveText("2 turnos cerca tuyo");
    await expect(tarjetas(page)).toHaveCount(2);
    await expect(tarjetas(page).filter({ hasText: "Pizzería Güerrín" })).toHaveCount(1);
    await expect(tarjetas(page).filter({ hasText: "Heladería Rapa" })).toHaveCount(1);

    // «Paga más» es aparte y se combina con el día elegido.
    await chip(page, "Paga más").click();
    await expect(chip(page, "Paga más")).toHaveAttribute("aria-pressed", "true");
    await expect(chip(page, "Fin de semana")).toHaveAttribute("aria-pressed", "true");
    await expect(titulo(page)).toHaveText("1 turno cerca tuyo");
    await expect(tarjetas(page).first()).toContainText("Heladería Rapa");

    // Tocar el elegido lo suelta; queda sólo «Paga más» (Café y Heladería).
    await chip(page, "Fin de semana").click();
    await expect(chip(page, "Fin de semana")).toHaveAttribute("aria-pressed", "false");
    await expect(titulo(page)).toHaveText("2 turnos cerca tuyo");
    await expect(tarjetas(page)).toHaveCount(2);

    // Sin resultados: Hoy + «Paga más». Una línea tranquila, no el estado vacío grande.
    await chip(page, "Hoy").click();
    const linea = page.getByTestId("mapa-sin-filtro").locator("visible=true");
    await expect(linea).toBeVisible();
    await expect(linea).toContainText("Sin turnos con estos filtros");
    await expect(titulo(page)).toHaveText("0 turnos cerca tuyo");
    await expect(page.getByTestId("mapa-vacio")).toHaveCount(0);
    await expect(pines(page)).toHaveCount(0);
    expect((await linea.boundingBox())!.height).toBeLessThan(80);
    // Los chips siguen a mano para cambiar el filtro.
    await expect(chip(page, "Hoy")).toBeVisible();
    const quitar = linea.getByRole("button", { name: "Quitar filtros" });
    expect((await quitar.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await quitar.click();
    await expect(linea).toHaveCount(0);
    await expect(titulo(page)).toHaveText("5 turnos cerca tuyo");
    // (La cámara siguió al pin elegido y se acercó: en cuadro quedan sólo algunos pines; la lista tiene los cinco.)
    await expect(tarjetas(page)).toHaveCount(5);
    await expect(pines(page).first()).toBeVisible();
    for (const n of ["Hoy", "Mañana", "Fin de semana", "Paga más"]) await expect(chip(page, n)).toHaveAttribute("aria-pressed", "false");
  });

  test(`${theme}: el chip elegido es la tecla blanca, mide 44 de alto táctil y recibe toques aunque el cielo no`, async ({ page }) => {
    await abrir(page, theme);
    const cielo = page.locator(".mapa-cielo");
    await expect(cielo).toHaveCSS("pointer-events", "none");
    const grupo = page.locator(".mapa-cielo").getByRole("group", { name: "Filtrar turnos" });
    await expect(grupo).toHaveCSS("pointer-events", "auto");
    for (const n of ["Hoy", "Mañana", "Fin de semana", "Paga más"]) {
      const caja = (await chip(page, n).boundingBox())!;
      expect(caja.height).toBeGreaterThanOrEqual(44);
    }
    // El del vidrio, sin elegir; elegido: blanco con letra azul hondo (sin ámbar).
    const cara = (n: string) => chip(page, n).locator(".chip-mapa-cara");
    await expect(cara("Hoy")).toHaveCSS("background-color", theme === "light" ? "rgba(255, 255, 255, 0.62)" : "rgba(255, 255, 255, 0.1)");
    await chip(page, "Hoy").click();
    await expect(cara("Hoy")).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(cara("Hoy")).toHaveCSS("color", "rgb(15, 58, 91)");
    // Un solo ámbar en toda la pantalla: «Postularme» del turno elegido.
    const ambares = await page
      .locator("button:visible")
      .evaluateAll((els) => els.filter((el) => /rgb\(246, 169, 42\)/.test(getComputedStyle(el).backgroundImage)).length);
    expect(ambares).toBe(1);
  });

  test(`${theme}: teclado (Enter y Espacio activan el chip) y sin scroll lateral a 320 y 390`, async ({ page }) => {
    await abrir(page, theme);
    await chip(page, "Mañana").focus();
    await page.keyboard.press("Enter");
    await expect(chip(page, "Mañana")).toHaveAttribute("aria-pressed", "true");
    await expect(titulo(page)).toHaveText("1 turno cerca tuyo");
    await page.keyboard.press("Space");
    await expect(chip(page, "Mañana")).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("Tab");
    await expect(chip(page, "Fin de semana")).toBeFocused();
    await page.keyboard.press("Space");
    await expect(chip(page, "Fin de semana")).toHaveAttribute("aria-pressed", "true");

    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await sinScrollLateral(page)).toBe(true);
    }
    // A 320 la fila no entra: se desliza de costado dentro de sí misma.
    const grupo = page.locator(".chips-mapa[data-variante='cielo']");
    await page.setViewportSize({ width: 320, height: 844 });
    expect(await grupo.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    expect(await sinScrollLateral(page)).toBe(true);
  });

  test(`${theme}: el pin lleva el ícono del rubro antes del pago y el nombre accesible no cambia`, async ({ page }) => {
    await abrir(page, theme);
    const bar = page.getByRole("button", { name: /^Turno de Bartender, \$\s?54\.000$/ });
    await expect(bar).toBeVisible();
    const icono = bar.locator("svg.pin-rubro");
    await expect(icono).toHaveCount(1);
    await expect(icono).toHaveAttribute("aria-hidden", "true");
    // Antes del pago (de izquierda a derecha).
    const [cIcono, cPago] = await Promise.all([icono.boundingBox(), bar.locator("span", { hasText: "54.000" }).first().boundingBox()]);
    expect(cIcono!.x + cIcono!.width).toBeLessThanOrEqual(cPago!.x + 1);
    // Sin zoom cerca, sin pastilla.
    await expect(page.getByTestId("pin-nombre")).toHaveCount(0);
    // El del medio de los turnos de esta noche: «urgente» sigue siendo el punto rojo.
    await expect(bar.locator(".pin-urgente")).toHaveCount(1);
    // «Paga por encima»: la flechita verde sigue estando en el de Café.
    await expect(page.getByRole("button", { name: /^Turno de Mozo\/a.*paga por encima/ }).locator(".pin-paga-mas")).toHaveCount(1);
  });
}

// Dos turnos a unos 240 m, uno al este del otro y algo más al sur (a zoom 14 todavía no se agrupan).
// Al tocar el primero la cámara se acerca (zoom 15) y sale la pastilla de cada pin; el del este queda
// cerca del borde derecho y la voltea a su izquierda.
const CENTRO = turno("centro", "bartender", "Bar Mirasol", -34.5895, -58.4285, "2026-11-18T20:00:00");
const ESTE = turno("este", "mozo", "Café Thames", -34.5905, -58.4262, "2026-11-18T21:00:00", { pay_amount: "45000.00" });

for (const theme of ["light", "dark"] as const) {
  test(`${theme}: al acercar sale el nombre del local en una pastilla del color de la tecla; si no entra a la derecha se voltea; tocarla es tocar el pin`, async ({ page }) => {
    await abrir(page, theme, [CENTRO, ESTE]);
    // A zoom 14: ningún nombre.
    await expect(page.getByTestId("pin-nombre")).toHaveCount(0);
    await page.getByRole("button", { name: /^Turno de Bartender/ }).click();
    const nombres = page.getByTestId("pin-nombre");
    await expect(nombres).toHaveCount(2, { timeout: 10_000 });

    const pastilla = (texto: string) => nombres.filter({ hasText: texto });
    const bar = pastilla("Bar Mirasol");
    const cafe = pastilla("Café Thames");
    // Del color de la tecla: blanca de día, la oscura de noche; letra en tinta; una línea.
    const fondoTecla = theme === "light" ? "rgb(255, 255, 255)" : "rgb(29, 40, 51)";
    for (const p of [bar, cafe]) {
      await expect(p).toHaveCSS("background-color", fondoTecla);
      await expect(p).toHaveCSS("white-space", "nowrap");
      await expect(p).toHaveCSS("text-overflow", "ellipsis");
      await expect(p).toHaveCSS("box-shadow", theme === "light" ? /rgba\(15, 58, 91, 0\.2\)/ : /rgba\(0, 0, 0, 0\.5\)/);
      expect((await p.boundingBox())!.width).toBeLessThanOrEqual(140);
    }
    // El nombre accesible del pin no la repite (la pastilla es aria-hidden).
    await expect(page.getByRole("button", { name: /^Turno de Bartender, \$\s?50\.000$/ })).toBeVisible();
    await expect(bar).toHaveAttribute("aria-hidden", "true");

    // Lados: la que entra queda a la derecha; la del pin que está cerca del borde, a la izquierda.
    const lados = await Promise.all([bar.getAttribute("data-lado"), cafe.getAttribute("data-lado")]);
    expect(lados).toContain("izquierda");
    for (const p of [bar, cafe]) {
      const caja = (await p.boundingBox())!;
      const pin = (await p.locator("xpath=..").boundingBox())!;
      expect(caja.x).toBeGreaterThanOrEqual(0);
      expect(caja.x + caja.width).toBeLessThanOrEqual(390);
      if ((await p.getAttribute("data-lado")) === "izquierda") expect(caja.x + caja.width).toBeLessThanOrEqual(pin.x + 1);
      else expect(caja.x).toBeGreaterThanOrEqual(pin.x + pin.width - 1);
    }

    // Tocar la pastilla = tocar el pin: elige ese turno.
    const noElegida = (await bar.locator("xpath=..").getAttribute("aria-pressed")) === "true" ? cafe : bar;
    await expect(noElegida.locator("xpath=..")).toHaveAttribute("aria-pressed", "false");
    await noElegida.click();
    await expect(noElegida.locator("xpath=..")).toHaveAttribute("aria-pressed", "true");
  });
}

test("una pastilla se corta con «…» a 140 px", async ({ page }) => {
  const largo = { ...CENTRO, company_name: "Restaurante Parrilla y Cantina El Gran Asador de la Esquina" };
  await abrir(page, "light", [largo]);
  await page.getByRole("button", { name: /^Turno de Bartender/ }).click();
  const p = page.getByTestId("pin-nombre");
  await expect(p).toBeVisible({ timeout: 10_000 });
  const w = (await p.boundingBox())!.width;
  expect(w).toBeLessThanOrEqual(140);
  expect(await p.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
});
