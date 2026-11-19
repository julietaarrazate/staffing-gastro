import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, isoEnDias, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

/**
 * Buscar del trabajador con la dirección «con relieve» (2026-11-19,
 * docs/historial/2026-11-19-buscar-trabajador-relieve.md): el cielo arriba con
 * el título en brocha, los rubros como pestañas con la raya, los filtros
 * rectos (en azul hondo prendidos) y cada turno como comanda de papel con sus
 * acciones. Se mide renderizado, en claro y de noche.
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
  test(`${theme}: cielo con el título en brocha, rubros con raya y cada turno es una comanda con sus acciones`, async ({ page }) => {
    await buscar(page, theme);
    const titulo = page.getByRole("heading", { level: 1, name: "Buscar turnos" });
    await expect(titulo).toHaveClass(/letra-cartel/);
    await expect(titulo.locator("xpath=..")).toHaveClass(/app-cielo/);
    // Los rubros son las pestañas de la app: sin píldora ni ámbar.
    const rubros = page.locator("[data-pestanas]");
    await expect(rubros.getByRole("button", { name: "Todos" })).toHaveAttribute("aria-pressed", "true");
    await expect(rubros.getByRole("button", { name: "Bartender" })).toBeVisible();

    const cards = page.getByTestId("buscar-card");
    await expect(cards).toHaveCount(2);
    const lavalle = cards.filter({ hasText: "Bar Lavalle" });
    await expect(lavalle).toHaveClass(/comanda/);
    await expect(lavalle.getByRole("heading", { level: 2 })).toHaveClass(/letra-cartel/);
    await expect(lavalle.getByText("Urgente", { exact: true })).toHaveClass(/sello-rojo/);
    for (const name of ["Cómo llegar", "Compartir", "No, gracias", "Postularme"]) {
      await expect(lavalle.getByRole("button", { name })).toBeVisible();
    }
    // La comanda entera lleva al detalle.
    await expect(lavalle.getByRole("link", { name: /Ver el turno de Bartender en Bar Lavalle/ })).toHaveAttribute("href", "/turno/b1");
  });

  test(`${theme}: los filtros son rectos y, prendidos, van en azul hondo y se leen`, async ({ page }) => {
    await buscar(page, theme);
    const urgentes = page.getByRole("switch", { name: /Urgentes/ });
    await expect(urgentes).toHaveCSS("border-top-left-radius", "10px");
    const apagado = await urgentes.evaluate((el) => ({ c: getComputedStyle(el).color, bg: getComputedStyle(el).backgroundColor }));
    expect(contraste(apagado.c, apagado.bg)).toBeGreaterThanOrEqual(4.5);
    await urgentes.click();
    await expect(urgentes).toHaveAttribute("aria-checked", "true");
    // `toHaveCSS` espera a que termine la transición del color.
    await expect(urgentes).toHaveCSS("background-color", theme === "light" ? "rgb(28, 84, 120)" : "rgb(154, 201, 231)");
    const prendido = await urgentes.evaluate((el) => ({ c: getComputedStyle(el).color, bg: getComputedStyle(el).backgroundColor }));
    expect(contraste(prendido.c, prendido.bg)).toBeGreaterThanOrEqual(4.5);
    // Sólo el urgente queda.
    await expect(page.getByTestId("buscar-card")).toHaveCount(1);
  });
}

test("a 320 px nada se sale de la pantalla", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await buscar(page, "light");
  await expect(page.getByTestId("buscar-card")).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

// Arreglos de la revisión del 2026-11-19: «Recepcionista» no se parte (a 320
// ni en la grilla de tres columnas), un nombre de comercio sin espacios no
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
  test(`a ${ancho} px ningún puesto se parte y nada se sale de la comanda`, async ({ page }) => {
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
          fuera: [...card.querySelectorAll("p, h2, dd, button")].some((el) => el.getBoundingClientRect().right > c.right + 1),
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
