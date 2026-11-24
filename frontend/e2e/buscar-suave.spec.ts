import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, isoEnDias, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

/**
 * Buscar del trabajador con la dirección suave (ADR-0028, 2026-11-20,
 * docs/historial/2026-11-20-buscar-trabajador-direccion-suave.md): el cielo
 * corto con el título en letra normal, los rubros como una fila de teclas suaves
 * en la hoja (desde el 2026-11-21, antes eran chips de vidrio en el cielo), la
 * hoja con los dos filtros y cada turno como fila suave con el pago en grande,
 * la marca «Urgente» al final del renglón y las acciones de siempre. Un solo
 * ámbar: «Postularme» del primero. Se mide renderizado, en claro y de noche.
 */
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const WORKER = { id: "u", email: "w@oido.test", full_name: "Sofía Demo", role: "worker", status: "activo", is_active: true, is_verified: true };
const turno = (id: string, position: string, company: string, extra: Record<string, unknown> = {}) => ({
  id, company_id: `c-${id}`, position, quantity: 1, start_at: isoEnDias(1, "21:00"), end_at: isoEnDias(2, "02:00"), pay_amount: "20000", currency: "ARS",
  tips: true, meal: false, dress_code: null, urgent: false, address: null, city: "Palermo, CABA", latitude: -34.585, longitude: -58.43, title: null, description: null,
  status: "publicado", worker_profile_id: null, created_at: "2026-11-01T12:00:00-03:00", company_name: company, company_logo_url: null, company_verified: false, ...extra,
});

async function buscar(page: Page, theme: "light" | "dark") {
  await setTheme(page, theme);
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  // Catch-all primero: Playwright resuelve la última ruta registrada.
  await page.route("**/api/v1/**", (r) => (r.request().method() === "GET" ? r.fulfill(json([])) : r.continue()));
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json(WORKER)));
  await page.route("**/api/v1/shifts/feed*", (r) =>
    r.fulfill(json([turno("b1", "bartender", "Bar Lavalle", { urgent: true, company_verified: true }), turno("b2", "mozo", "Café Belgrano", { pay_amount: "15000" })])),
  );
  await page.goto("/buscar");
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

const contraste = (a: string, b: string) => {
  const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
  const lum = ([r, g, bl]: number[]) => {
    const x = [r, g, bl].map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * x[0] + 0.7152 * x[1] + 0.0722 * x[2];
  };
  const [p, q] = [lum(rgb(a)), lum(rgb(b))].sort((m, n) => n - m);
  return (p + 0.05) / (q + 0.05);
};

for (const theme of ["light", "dark"] as const) {
  test(`${theme}: cielo con el título en letra normal, rubros de vidrio y cada turno es una fila suave con sus acciones`, async ({ page }) => {
    await buscar(page, theme);
    const titulo = page.getByRole("heading", { level: 1, name: "Buscar turnos" });
    await expect(titulo).toHaveClass(/titulo-pantalla/);
    await expect(titulo).not.toHaveClass(/letra-cartel/);
    await expect(titulo.locator("xpath=ancestor::*[contains(@class,'app-cielo')][1]")).toHaveClass(/app-cielo/);
    await expect(page.locator(".estilo-suave .hoja")).toBeVisible();
    // Los rubros son teclas suaves en la hoja (no en el cielo), con el ícono y
    // el nombre corto; sin «Todos»: ninguno elegido es «todos».
    const rubros = page.getByRole("group", { name: "Rubro" });
    await expect(rubros.locator("xpath=ancestor::*[contains(@class,'app-cielo')]")).toHaveCount(0);
    await expect(rubros.locator("xpath=ancestor::*[contains(@class,'hoja')]")).toHaveCount(1);
    await expect(rubros.getByRole("button", { name: "Todos" })).toHaveCount(0);
    await expect(rubros.getByRole("button")).toHaveCount(10);
    const bartender = rubros.getByRole("button", { name: "Bartender" });
    await expect(bartender).toHaveClass(/tecla-rubro/);
    await expect(bartender).toHaveAttribute("aria-pressed", "false");
    await expect(bartender.locator("svg")).toHaveCount(1);
    await expect(bartender).toContainText("Barra");

    const cards = page.getByTestId("buscar-card");
    await expect(cards).toHaveCount(2);
    await expect(page.getByTestId("buscar-resumen")).toHaveText("2 turnos, primero los urgentes");
    const lavalle = cards.filter({ hasText: "Bar Lavalle" });
    await expect(lavalle).toHaveClass(/tecla/);
    await expect(lavalle).not.toHaveClass(/comanda/);
    await expect(lavalle.getByRole("heading", { level: 2, name: "Bartender" })).toBeVisible();
    // El pago es lo más grande de la fila.
    const pago = lavalle.getByTestId("buscar-pago");
    await expect(pago).toContainText("20.000");
    const [tamPago, tamPuesto] = await Promise.all([
      pago.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
      lavalle.getByRole("heading", { level: 2 }).evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    ]);
    expect(tamPago).toBeGreaterThan(tamPuesto);
    await expect(lavalle.getByText("Urgente", { exact: true })).toHaveClass(/chip-urgente/);
    await expect(lavalle.getByRole("img", { name: "Comercio verificado" })).toBeVisible();
    for (const name of ["Cómo llegar", "Compartir", "No, gracias", "Postularme"]) {
      const boton = lavalle.getByRole("button", { name });
      await expect(boton).toBeVisible();
      // Todo lo que se toca mide 44 px o más.
      const caja = await boton.boundingBox();
      expect(caja!.height, name).toBeGreaterThanOrEqual(44);
      expect(caja!.width, name).toBeGreaterThanOrEqual(44);
    }
    // La fila entera lleva al detalle.
    await expect(lavalle.getByRole("link", { name: /Ver el turno de Bartender en Bar Lavalle/ })).toHaveAttribute("href", "/turno/b1");
    // Un solo ámbar en la pantalla: «Postularme» del primero; los demás, quietos.
    await expect(page.locator("main .boton-relieve")).toHaveCount(1);
    await expect(lavalle.getByRole("button", { name: "Postularme" })).toHaveClass(/boton-relieve/);
    await expect(cards.filter({ hasText: "Café Belgrano" }).getByRole("button", { name: "Postularme" })).toHaveClass(/boton-quieto/);
    // Sin foto, la miniatura es el cielo (no el marrón por rubro).
    await expect(lavalle.locator("[data-portada='mini']")).toBeVisible();
    await expect(lavalle.locator(".rubro-tile")).toHaveCount(0);
  });

  test(`${theme}: los filtros son chips de 44 px y, prendidos, van en azul hondo y se leen`, async ({ page }) => {
    await buscar(page, theme);
    const urgentes = page.getByRole("switch", { name: /Urgentes/ });
    expect((await urgentes.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const apagado = await urgentes.evaluate((el) => ({ c: getComputedStyle(el).color, bg: getComputedStyle(el).backgroundColor }));
    expect(contraste(apagado.c, apagado.bg)).toBeGreaterThanOrEqual(4.5);
    await urgentes.click();
    await expect(urgentes).toHaveAttribute("aria-checked", "true");
    await expect(urgentes).toHaveClass(/chip-elegido/);
    // El relleno es el degradé azul hondo: la letra blanca se mide contra su
    // tono más claro.
    await expect(urgentes).toHaveCSS("color", "rgb(255, 255, 255)");
    expect(await urgentes.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain("rgb(42, 115, 163)");
    expect(contraste("rgb(255, 255, 255)", "rgb(42, 115, 163)")).toBeGreaterThanOrEqual(4.5);
    // Sólo el urgente queda, y el resumen lo dice.
    await expect(page.getByTestId("buscar-card")).toHaveCount(1);
    await expect(page.getByTestId("buscar-resumen")).toHaveText("1 turno urgente");

    const pagos = page.getByRole("button", { name: /Mejores pagos/ });
    await urgentes.click();
    await pagos.click();
    await expect(pagos).toHaveAttribute("aria-pressed", "true");
    await expect(pagos).toHaveClass(/chip-elegido/);
    await expect(page.getByTestId("buscar-resumen")).toHaveText("2 turnos, primero los que mejor pagan por hora");

  });

  test(`${theme}: la tecla de rubro elegida va en azul hondo, se suelta al tocarla de nuevo y el pedido lleva el rubro`, async ({ page }) => {
    const pedidos: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/v1/shifts/feed")) pedidos.push(new URL(r.url()).search);
    });
    await buscar(page, theme);
    // Sin rubro elegido: se piden todos los rubros, ninguno en particular.
    await expect(page.getByTestId("buscar-card")).toHaveCount(2);
    expect(pedidos.at(-1)).toContain("positions=mozo");
    expect(pedidos.at(-1)).not.toContain("position=");
    const rubros = page.getByRole("group", { name: "Rubro" });
    const barra = rubros.getByRole("button", { name: "Bartender" });
    const alto = (await barra.boundingBox())!.height;
    expect(alto).toBeGreaterThanOrEqual(44);

    await barra.click();
    await expect(barra).toHaveAttribute("aria-pressed", "true");
    expect(await barra.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain("rgb(42, 115, 163)");
    await expect(barra).toHaveCSS("color", "rgb(255, 255, 255)");
    expect(contraste("rgb(255, 255, 255)", "rgb(42, 115, 163)")).toBeGreaterThanOrEqual(4.5);
    await expect.poll(() => pedidos.at(-1)).toContain("position=bartender");
    expect(pedidos.at(-1)).not.toContain("positions=");
    // Elegir otra suelta la anterior (una a la vez).
    await rubros.getByRole("button", { name: "Mozo/a" }).click();
    await expect(barra).toHaveAttribute("aria-pressed", "false");
    await expect(rubros.getByRole("button", { name: "Mozo/a" })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => pedidos.at(-1)).toContain("position=mozo");
    // Tocarla de nuevo la suelta y vuelve el pedido de todos los rubros.
    await rubros.getByRole("button", { name: "Mozo/a" }).click();
    await expect(rubros.getByRole("button", { name: "Mozo/a" })).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => pedidos.at(-1)).toContain("positions=mozo");
    expect(pedidos.at(-1)).not.toMatch(/[?&]position=/);
    await expect(rubros.locator("[aria-pressed='true']")).toHaveCount(0);
  });
}

test("con el teclado: Tab llega a cada rubro, Enter lo elige y Espacio lo suelta", async ({ page }) => {
  await buscar(page, "light");
  const rubros = page.getByRole("group", { name: "Rubro" });
  const mozo = rubros.getByRole("button", { name: "Mozo/a" });
  await mozo.focus();
  await expect(mozo).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(mozo).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Space");
  await expect(mozo).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Tab");
  await expect(rubros.getByRole("button", { name: "Bartender" })).toBeFocused();
});

for (const ancho of [320, 390]) {
  for (const theme of ["light", "dark"] as const) {
    test(`a ${ancho} px (${theme}) los rubros se deslizan sin ensanchar la página y el cielo no queda con un hueco`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: 800 });
      await buscar(page, theme);
      const carril = page.getByTestId("buscar-rubros");
      const medidas = await carril.evaluate((el) => ({ scroll: el.scrollWidth, ancho: el.clientWidth }));
      expect(medidas.scroll).toBeGreaterThan(medidas.ancho);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(ancho);
      // El carril se desliza por dentro: el último rubro se alcanza.
      await page.getByRole("button", { name: "Personal de salón" }).scrollIntoViewIfNeeded();
      await expect(page.getByRole("button", { name: "Personal de salón" })).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(ancho);
      // El cielo termina justo después de la frase: sin hueco entre ella y la hoja.
      const { frase, hoja } = await page.evaluate(() => ({
        frase: document.querySelector(".app-cielo p")!.getBoundingClientRect().bottom,
        hoja: document.querySelector(".hoja")!.getBoundingClientRect().top,
      }));
      expect(hoja - frase).toBeLessThanOrEqual(40);
    });
  }
}

test("a 320 px nada se sale de la pantalla", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await buscar(page, "light");
  await expect(page.getByTestId("buscar-card")).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

// Arreglos de la revisión del 2026-11-19: «Recepcionista» no se parte (a 320
// ni en la grilla de compu), un nombre de comercio sin espacios no
// ensancha la página, y en la grilla las acciones quedan todas abajo.
async function conTurnos(page: Page, turnos: unknown[]) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await page.route("**/api/v1/**", (r) => (r.request().method() === "GET" ? r.fulfill(json([])) : r.continue()));
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json(WORKER)));
  await page.route("**/api/v1/shifts/feed*", (r) => r.fulfill(json(turnos)));
  await page.goto("/buscar");
  await expect(page.getByTestId("buscar-card").first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

for (const ancho of [320, 1280]) {
  test(`a ${ancho} px ningún puesto se parte y nada se sale de la fila`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 900 });
    await conTurnos(page, [
      turno("r1", "recepcionista", "Hotel Palermo", { company_cover_url: "/landing/bar3.webp" }),
      turno("r2", "personal_eventos", "Supercalifragilisticoespialidosocomercio", { urgent: true }),
      turno("r3", "ayudante_cocina", "Bodegón Sur", { latitude: null, longitude: null }),
    ]);
    const medidas = await page.getByTestId("buscar-card").evaluateAll((cards) =>
      cards.map((card) => {
        const h2 = card.querySelector("h2") as HTMLElement;
        const r = document.createRange();
        r.selectNodeContents(h2);
        const c = card.getBoundingClientRect();
        return {
          puesto: (h2.textContent ?? "").trim(),
          // Un rectángulo por renglón: una palabra partida suma uno de más.
          renglones: r.getClientRects().length,
          palabras: (h2.textContent ?? "").trim().split(/\s+/).length,
          fuera: [...card.querySelectorAll("p, h2, span, button")].some((el) => el.getBoundingClientRect().right > c.right + 1),
        };
      }),
    );
    for (const m of medidas) {
      expect(m.fuera, m.puesto).toBe(false);
      expect(m.renglones, m.puesto).toBeLessThanOrEqual(m.palabras);
    }
    expect(medidas.find((m) => m.puesto === "Recepcionista")?.renglones).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(ancho);
  });
}

test("en la grilla de compu, las acciones de una fila quedan a la misma altura", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await conTurnos(page, [
    turno("g1", "bartender", "Bar Lavalle", { urgent: true, company_verified: true }),
    turno("g2", "mozo", "Café", { latitude: null, longitude: null }),
    turno("g3", "personal_eventos", "Salón de Fiestas Los Hermanos del Puerto de Palermo"),
  ]);
  const bajos = await page.getByTestId("buscar-card").evaluateAll((cards) =>
    cards.map((card) => {
      const boton = [...card.querySelectorAll("button")].find((b) => b.textContent?.includes("Postularme")) as HTMLElement;
      return Math.round(card.getBoundingClientRect().bottom - boton.getBoundingClientRect().bottom);
    }),
  );
  expect(new Set(bajos).size).toBe(1);
});

// Revisión del 2026-11-20: con la letra al 200 % a 320 px «Postularme» se
// salía de la fila y ensanchaba la página; en la compu los rubros que no
// entraban en el carril no se podían alcanzar con el mouse; y el aire entre
// los botones de la fila no abría el detalle.
test("con la letra al 200 % a 320 px nada se sale y ningún puesto se parte", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => (document.documentElement.style.fontSize = "200%")));
  await conTurnos(page, [
    turno("z1", "bartender", "Supercalifragilisticoespialidosocomercio", { urgent: true, company_verified: true }),
    turno("z2", "recepcionista", "Hotel Palermo", { urgent: true, hourly_pay_amount: "10000" }),
  ]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  const fuera = await page.getByTestId("buscar-card").evaluateAll((cards) =>
    cards.flatMap((card) => {
      const c = card.getBoundingClientRect();
      return [...card.querySelectorAll("p, h2, button")].filter((el) => el.getBoundingClientRect().right > c.right + 1).map((el) => el.textContent);
    }),
  );
  expect(fuera).toEqual([]);
  const h2 = page.getByTestId("buscar-card").nth(1).getByRole("heading", { level: 2 });
  expect(await h2.evaluate((el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getClientRects().length; })).toBe(1);
});

test("en la compu todos los rubros quedan a la vista (bajan de renglón)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await conTurnos(page, [turno("c1", "bartender", "Bar Lavalle")]);
  const carril = page.getByTestId("buscar-rubros");
  const cajas = await carril.getByRole("button").evaluateAll((bs) => bs.map((b) => b.getBoundingClientRect().right));
  const borde = await carril.evaluate((el) => el.getBoundingClientRect().right);
  for (const r of cajas) expect(r).toBeLessThanOrEqual(borde + 1);
});

test("el aire entre los botones de la fila también abre el detalle", async ({ page }) => {
  await conTurnos(page, [turno("a1", "bartender", "Bar Lavalle")]);
  await page.route("**/turno/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<html><body>detalle</body></html>" }));
  const card = page.getByTestId("buscar-card");
  const compartir = (await card.getByRole("button", { name: "Compartir" }).boundingBox())!;
  // 4 px a la derecha de «Compartir»: el hueco de 8 px entre dos botones.
  await page.mouse.click(compartir.x + compartir.width + 4, compartir.y + compartir.height / 2);
  await expect(page).toHaveURL(/\/turno\/a1$/);
});

// Escritorio, renglones 4 y 10 (2026-11-24): en la compu (1440) el mapa va al
// lado de la lista, con el pin de cada turno; en el celular y la tablet no se
// monta.
test("en la compu la lista y el mapa van lado a lado, y tocar un pin resalta su fila", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await conTurnos(page, [turno("c1", "bartender", "Bar Lavalle"), turno("c2", "mozo", "Café Belgrano", { pay_amount: "15000", latitude: -34.5885, longitude: -58.4262 })]);
  const filas = page.getByTestId("buscar-card");
  const mapa = page.getByTestId("buscar-mapa");
  await expect(mapa).toBeVisible();
  const [f1, f2, m] = [(await filas.nth(0).boundingBox())!, (await filas.nth(1).boundingBox())!, (await mapa.boundingBox())!];
  // Una sola columna de turnos a la izquierda y el mapa a la derecha, a la altura de la lista.
  expect(Math.abs(f1.x - f2.x)).toBeLessThan(2);
  expect(f2.y).toBeGreaterThan(f1.y + f1.height - 1);
  expect(m.x).toBeGreaterThan(f1.x + f1.width);
  expect(m.width).toBeGreaterThan(380);
  expect(m.height).toBeGreaterThan(500);
  expect(m.y).toBeLessThan(f1.y + 40);
  // Nada corre la página, ni se sale del marco de 1024 px.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
  expect(m.x + m.width).toBeLessThanOrEqual(1440 - (1440 - 1024) / 2 + 1);
  // Tocar el pin del segundo turno resalta su fila.
  await page.getByRole("button", { name: /^Turno de Mozo/ }).click({ timeout: 20_000 });
  await expect(page.locator('[data-turno-id="c2"]')).toHaveAttribute("data-elegido", "");
  await expect(page.locator('[data-turno-id="c1"]')).not.toHaveAttribute("data-elegido", "");
});

test("en el celular y en la tablet no hay mapa al lado de la lista", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await conTurnos(page, [turno("c1", "bartender", "Bar Lavalle")]);
  await expect(page.getByTestId("buscar-card")).toHaveCount(1);
  await expect(page.getByTestId("buscar-mapa")).toHaveCount(0);
  await page.setViewportSize({ width: 800, height: 900 });
  await expect(page.getByTestId("buscar-mapa")).toHaveCount(0);
});
