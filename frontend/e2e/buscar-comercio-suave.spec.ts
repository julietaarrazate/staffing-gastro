import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

/**
 * Buscar del comercio con la dirección suave (2026-11-21, ADR-0028,
 * docs/historial/2026-11-21-buscar-comercio-direccion-suave.md): el mapa es el
 * cielo con el título encima, los filtros de vidrio, los pines como teclas
 * blancas y cada persona en una fila suave; sin ámbar. Se mide renderizado, en
 * claro y de noche. Reemplaza al spec de la dirección «con relieve».
 */
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const EMPLOYER = { id: "u-e", email: "e@oido.test", full_name: "Julieta Demo", role: "employer", status: "activo", is_active: true, is_verified: true };
const trabajador = (id: string, nombre: string, extra: Record<string, unknown> = {}) => ({
  profile_id: id, user_id: `u-${id}`, full_name: nombre, photo_url: null, rating: 4.6, distance_km: 1.2, latitude: -34.585, longitude: -58.43,
  skills: ["mozo"], is_live: false, position_updated_at: null, ...extra,
});

async function buscar(page: Page, theme: "light" | "dark", gente: unknown[] | null = null, ancho = 1280) {
  await setTheme(page, theme);
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  // Catch-all primero: Playwright resuelve la última ruta registrada.
  await page.route("**/api/v1/**", (r) => (r.request().method() === "GET" ? r.fulfill(json([])) : r.continue()));
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json(EMPLOYER)));
  await page.route("**/api/v1/companies/me/profile", (r) =>
    r.fulfill(json({ id: "c1", user_id: "u-e", name: "Bar Central", logo_url: null, category: null, description: null, address: "Honduras 5200", city: "Palermo, CABA", latitude: -34.5875, longitude: -58.4257, capacity: null, opening_hours: null, rating: 4.5, events_published: 0, on_time_payment_rate: 1, late_cancellations: 0 })),
  );
  await page.route("**/api/v1/matching/search**", (r) =>
    r.fulfill(json(gente ?? [
      trabajador("w1", "Sofía Ramírez", { is_live: true, position_updated_at: new Date(Date.now() - 5 * 60_000).toISOString(), skills: ["bartender", "mozo"] }),
      trabajador("w2", "Lucas Medina"),
    ])),
  );
  await page.setViewportSize({ width: ancho, height: ancho < 768 ? 800 : 900 });
  await page.goto("/search");
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
const contraste = (a: string, b: string) => {
  const lum = ([r, g, bl]: number[]) => {
    const x = [r, g, bl].map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * x[0] + 0.7152 * x[1] + 0.0722 * x[2];
  };
  const [p, q] = [lum(rgb(a)), lum(rgb(b))].sort((m, n) => n - m);
  return (p + 0.05) / (q + 0.05);
};

for (const theme of ["light", "dark"] as const) {
  test(`${theme}: título, filtros de vidrio y filas suaves sin relieve ni ámbar`, async ({ page }) => {
    await buscar(page, theme);
    await expect(page.locator("main .estilo-suave, .estilo-suave").first()).toBeVisible();
    const panel = page.locator("aside");
    await expect(panel.getByRole("heading", { name: "2 personas cerca de tu local" })).toBeVisible();
    await expect(panel.getByTestId("search-origin")).toContainText("Desde tu local · Honduras 5200");

    // Filtros: mismos controles, de vidrio; la lupa ya no es el botón con relieve.
    const lupa = panel.getByRole("button", { name: "Buscar" });
    await expect(lupa).toHaveClass(/boton-vidrio/);
    await expect(lupa).not.toHaveClass(/boton-relieve/);
    await expect(panel.getByRole("combobox")).toHaveClass(/campo-vidrio/);
    await expect(panel.getByLabel("Radio en kilómetros")).toHaveClass(/campo-vidrio/);

    // Filas suaves: ni ficha con relieve ni filete.
    const filas = panel.getByRole("link").filter({ hasText: /Ramírez|Medina/ });
    await expect(filas).toHaveCount(2);
    for (const i of [0, 1]) {
      await expect(filas.nth(i)).toHaveClass(/mapa-turno/);
      await expect(filas.nth(i)).not.toHaveClass(/tarjeta-relieve/);
    }
    // Quien está «Disponible ahora»: el punto y el texto en verde (no ámbar).
    const viva = filas.filter({ hasText: "Sofía Ramírez" });
    await expect(viva.getByText("Disponible ahora")).toBeVisible();
    await expect(viva.getByText(/hace \d+ min/)).toBeVisible();
    const verde = rgb(await viva.getByText("Disponible ahora").evaluate((el) => getComputedStyle(el).color));
    expect(verde[1]).toBeGreaterThan(verde[0]);
    // Los rubros, como chips suaves.
    await expect(viva.locator(".chip-suave")).toHaveCount(2);

    // Sin ámbar en la pantalla: ningún botón con el fondo del primario.
    const ambar = await page.evaluate(() => {
      const primario = getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim();
      return [...document.querySelectorAll("main button, aside button")].filter((b) => {
        const bg = getComputedStyle(b).backgroundColor;
        return primario && bg === (() => { const d = document.createElement("i"); d.style.color = primario; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; })();
      }).length;
    });
    expect(ambar).toBe(0);

    // Las estrellas de la nota (en las filas y en los pines) no son el ámbar de
    // `text-rating`: van en el azul de los links.
    await expect(page.locator(".pin-nota svg").first()).toBeAttached();
    const estrellas = await page.evaluate(() => {
      const sonda = document.createElement("span");
      sonda.className = "text-rating";
      document.body.appendChild(sonda);
      const ambar = getComputedStyle(sonda).color;
      sonda.remove();
      const colores = [...document.querySelectorAll(".persona-fila svg[class], .persona-fila [role=img] svg, .pin-nota svg")]
        .filter((el) => (el.closest("[role=img], .pin-nota") !== null))
        .map((el) => getComputedStyle(el).color);
      return { ambar, colores };
    });
    expect(estrellas.colores.length).toBeGreaterThan(4);
    for (const c of estrellas.colores) expect(c).not.toBe(estrellas.ambar);

    // Todo lo escrito en las filas se lee contra la fila.
    const peor = await filas.evaluateAll((links) =>
      links.flatMap((link) => {
        const bg = getComputedStyle(link).backgroundColor;
        return [...link.querySelectorAll("p, span")]
          .filter((el) => el.children.length === 0 && (el.textContent ?? "").trim().length > 1)
          .map((el) => ({ t: el.textContent, c: getComputedStyle(el).color, bg: getComputedStyle(el.closest(".chip-suave") ?? link).backgroundColor || bg }));
      }),
    );
    for (const p of peor) expect(contraste(p.c, p.bg), String(p.t)).toBeGreaterThanOrEqual(4.5);
  });
}

test("celular: el título va sobre el mapa, la hoja con el borde de la hoja de /map y 1 sola persona", async ({ page }) => {
  await buscar(page, "light", [trabajador("w1", "Sofía Ramírez")], 390);
  const cielo = page.locator(".mapa-cielo");
  await expect(cielo.getByRole("heading", { name: "1 persona cerca de tu local" })).toBeVisible();
  await expect(cielo.getByRole("button", { name: "Buscar" })).toBeVisible();
  await expect(page.locator(".mapa-hoja")).toHaveCount(1);
  await expect(page.getByLabel("Ver perfil de Sofía Ramírez")).toBeVisible();
});

test("a 320 px los filtros entran enteros: el rubro se achica y la lupa queda a la vista", async ({ page }) => {
  await buscar(page, "light", null, 320);
  const lupa = page.locator(".mapa-cielo").getByRole("button", { name: "Buscar" });
  await expect(lupa).toBeVisible();
  const caja = (await lupa.boundingBox())!;
  expect(caja.x + caja.width).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

test("sin local: mismos textos, y «Completar ubicación» sin ámbar", async ({ page }) => {
  await buscar(page, "light", null, 1280);
  await page.route("**/api/v1/companies/me/profile", (r) =>
    r.fulfill(json({ id: "c1", user_id: "u-e", name: "Bar", logo_url: null, address: null, city: null, latitude: null, longitude: null })),
  );
  await page.reload();
  const panel = page.locator("aside");
  await expect(panel.getByRole("heading", { name: "Falta la ubicación de tu local" })).toBeVisible();
  await expect(panel.getByText("Tu local no tiene ubicación")).toBeVisible();
  const boton = panel.getByRole("button", { name: "Completar ubicación" });
  const fondo = await boton.evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(fondo).toContain("gradient");
});

// La hoja arrastrada al máximo queda debajo de los filtros (con el título en
// dos renglones y 25 personas), en tres anchos de celular.
for (const ancho of [320, 390, 430]) {
  test(`${ancho} px: con la hoja al máximo los filtros y el título siguen a la vista`, async ({ page }) => {
    const gente = Array.from({ length: 25 }, (_, i) => trabajador(`w${i}`, `Persona número ${i}`, { distance_km: 0.5 + i * 0.2 }));
    await buscar(page, "light", gente, ancho);
    await page.setViewportSize({ width: ancho, height: 740 });
    const cielo = page.locator(".mapa-cielo");
    const titulo = cielo.getByRole("heading", { name: "25 personas cerca de tu local" });
    await expect(titulo).toBeVisible();
    // Dos renglones: el título es más alto que una línea de 32 px.
    expect((await titulo.boundingBox())!.height).toBeGreaterThan(50);
    await page.locator(".mapa-hoja").locator("..").locator(".cursor-grab").click();
    const hoja = page.locator(".mapa-hoja");
    const lupa = cielo.getByRole("button", { name: "Buscar" });
    // Asentada (la animación dura 200 ms): la hoja empieza debajo de los filtros.
    await expect
      .poll(async () => (await hoja.boundingBox())!.y - (await lupa.boundingBox())!.y - (await lupa.boundingBox())!.height)
      .toBeGreaterThanOrEqual(0);
    // Y se puede tocar la lupa: lo que hay en su centro es ella, no la hoja.
    const c = (await lupa.boundingBox())!;
    const arriba = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest("button")?.getAttribute("aria-label"), [c.x + c.width / 2, c.y + c.height / 2]);
    expect(arriba).toBe("Buscar");
    // La hoja sigue siendo útil: ocupa más que el peek.
    expect((await hoja.boundingBox())!.height).toBeGreaterThan(200);
  });
}

// Con poco alto (celular de costado, teclado abierto) el cielo no se come la
// hoja: al máximo conserva un piso de 260 px y la lista se puede leer.
test("con 400 px de alto la hoja al máximo sigue mostrando la lista", async ({ page }) => {
  const gente = Array.from({ length: 25 }, (_, i) => trabajador(`w${i}`, `Persona número ${i}`, { distance_km: 0.5 + i * 0.2 }));
  await buscar(page, "light", gente, 390);
  await page.setViewportSize({ width: 390, height: 400 });
  await page.locator(".mapa-hoja").locator("..").locator(".cursor-grab").click();
  const hoja = page.locator(".mapa-hoja");
  await expect.poll(async () => (await hoja.boundingBox())!.height).toBeGreaterThanOrEqual(240);
  // Entera dentro de la pantalla, y con al menos una persona completa a la vista.
  const caja = (await hoja.boundingBox())!;
  expect(caja.y).toBeGreaterThanOrEqual(0);
  await expect(hoja.getByText("Persona número 0", { exact: true })).toBeInViewport({ ratio: 1 });
});

// El cielo no recibe toques, pero el enlace del encabezado sí (en el celular
// el botón del estado vacío queda abajo, en la hoja replegada).
test("celular sin local: «Completar ubicación del local» del cielo se puede tocar y lleva a editar", async ({ page }) => {
  await buscar(page, "light", null, 390);
  await page.route("**/api/v1/companies/me/profile", (r) =>
    r.fulfill(json({ id: "c1", user_id: "u-e", name: "Bar", logo_url: null, address: null, city: null, latitude: null, longitude: null })),
  );
  await page.reload();
  await page.locator(".mapa-cielo").getByRole("link", { name: "Completar ubicación del local" }).click();
  await expect(page).toHaveURL(/\/profile\/edit/);
});

// La API no da el total: con una página llena (50) el título dice «50 o más» y
// «Ver más personas» pide la siguiente (`offset`); al venir corta, el título
// vuelve a ser el total exacto.
test("con 50 resultados el título dice «50 o más» y «Ver más personas» trae el resto", async ({ page }) => {
  const pagina1 = Array.from({ length: 50 }, (_, i) => trabajador(`w${i}`, `Persona número ${i}`, { distance_km: 0.5 + i * 0.1 }));
  const pagina2 = Array.from({ length: 3 }, (_, i) => trabajador(`x${i}`, `Persona extra ${i}`, { distance_km: 9 + i }));
  const pedidos: string[] = [];
  await buscar(page, "light", pagina1);
  await page.route("**/api/v1/matching/search**", (r) => {
    const url = new URL(r.request().url());
    pedidos.push(`${url.searchParams.get("limit")}/${url.searchParams.get("offset")}`);
    return r.fulfill(json(url.searchParams.get("offset") === "50" ? pagina2 : pagina1));
  });
  await page.goto("/search");
  const panel = page.locator("aside");
  await expect(panel.getByRole("heading", { name: "50 o más personas cerca de tu local" })).toBeVisible();
  await panel.getByRole("button", { name: "Ver más personas" }).click();
  await expect(panel.getByRole("heading", { name: "53 personas cerca de tu local" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Ver más personas" })).toHaveCount(0);
  await expect(panel.getByRole("link").filter({ hasText: "Persona extra 2" })).toBeVisible();
  expect(pedidos).toContain("50/0");
  expect(pedidos).toContain("50/50");
});

// Escritorio, renglón 4 (2026-11-24): en la compu el comercio ya ve la lista de
// personas a la izquierda (panel de 400 px) y el mapa ocupando el resto.
test("en la compu el panel de personas va a la izquierda y el mapa ocupa el resto", async ({ page }) => {
  await buscar(page, "light", null, 1440);
  const panel = (await page.locator("aside").boundingBox())!;
  const mapa = (await page.locator(".buscar-mapa").boundingBox())!;
  expect(panel.width).toBeLessThanOrEqual(401);
  expect(Math.abs(mapa.x - (panel.x + panel.width))).toBeLessThan(2);
  expect(mapa.width).toBeGreaterThan(900);
  expect(Math.abs(mapa.y - panel.y)).toBeLessThan(2);
  const filas = page.locator("aside").getByRole("link").filter({ hasText: /Ramírez|Medina/ });
  const [a, b] = [(await filas.nth(0).boundingBox())!, (await filas.nth(1).boundingBox())!];
  expect(Math.abs(a.x - b.x)).toBeLessThan(2);
  expect(b.y).toBeGreaterThan(a.y + a.height - 1);
});
