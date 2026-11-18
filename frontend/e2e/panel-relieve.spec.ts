import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, isoEnDias, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

/**
 * El panel del comercio con la dirección «con relieve» (2026-11-18,
 * docs/historial/2026-11-18-panel-comercio-relieve.md): los turnos son
 * comandas de papel; los que están en curso cuelgan del riel, sobre la banda
 * azul hondo, y los que ya salieron van debajo, sobre el lienzo.
 */
const SESSION = { id: "u-e", email: "e@oido.test", full_name: "Julieta Demo", role: "employer", status: "activo", is_active: true, is_verified: true };
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

function shift(id: string, status: string, position: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    company_id: "c1",
    position,
    quantity: 1,
    start_at: isoEnDias(1, "21:00"),
    end_at: isoEnDias(2, "02:00"),
    pay_amount: "20000",
    currency: "ARS",
    tips: true,
    meal: false,
    dress_code: null,
    urgent: false,
    address: null,
    city: "Palermo, CABA",
    latitude: null,
    longitude: null,
    title: null,
    description: null,
    status,
    worker_profile_id: status === "publicado" || status === "cancelado" ? null : "wp1",
    created_at: "2026-07-01T12:00:00-03:00",
    company_name: "Bar Lavalle",
    company_logo_url: null,
    ...extra,
  };
}

async function panel(page: Page, turnos: unknown[]) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  // Catch-all primero: Playwright resuelve la última ruta registrada.
  await page.route("**/api/v1/**", (route) => (route.request().method() === "GET" ? route.fulfill(json([])) : route.continue()));
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json(SESSION)));
  await page.route("**/api/v1/shifts/me", (r) => r.fulfill(json(turnos)));
}

const TURNOS = [
  shift("s1", "publicado", "mozo", { urgent: true }),
  shift("s2", "confirmado", "bartender"),
  shift("s3", "finalizado", "barista"),
  shift("s4", "cancelado", "runner"),
];

test("los turnos en curso cuelgan del riel, sobre la banda; los que ya salieron van debajo", async ({ page }) => {
  await panel(page, TURNOS);
  await page.goto("/shifts");
  await expect(page.getByRole("heading", { level: 1, name: "Hola, Julieta" })).toBeVisible();
  const lista = page.getByTestId("shifts-panel-list");
  const banda = lista.locator(".app-banda");
  await expect(banda).toHaveCount(1);
  await expect(banda.locator(".riel")).toBeVisible();
  await expect(banda.locator("[data-family]")).toHaveCount(2);
  await expect(banda.locator('[data-family="buscando"]')).toBeVisible();
  await expect(banda.locator('[data-family="en_marcha"]')).toBeVisible();
  // Terminados y cancelados, fuera de la banda.
  for (const familia of ["terminado", "cancelado"]) {
    await expect(lista.locator(`[data-family="${familia}"]`)).toBeVisible();
    await expect(banda.locator(`[data-family="${familia}"]`)).toHaveCount(0);
  }
  // Cada turno es una comanda, con el puesto y el estado como sello.
  const urgente = lista.locator('[data-shift-id="s1"]');
  await expect(urgente).toHaveClass(/comanda/);
  await expect(urgente.getByRole("heading", { name: "Mozo/a" })).toBeVisible();
  await expect(urgente).toContainText("Urgente");
  await expect(urgente.getByTestId("shift-status")).toHaveText("Publicado");
  await expect(urgente.getByTestId("shift-status")).toHaveClass(/sello-goma/);
  // El título de una familia se lee sobre la banda (blanco sobre azul hondo).
  await expect(banda.getByRole("heading", { name: /Buscando personal/ })).toHaveCSS("color", "rgb(255, 255, 255)");
});

test("una pestaña en curso sin turnos muestra su cartel de vacío sobre el lienzo, no sobre la banda", async ({ page }) => {
  await panel(page, [shift("s3", "finalizado", "barista")]);
  await page.goto("/shifts?tab=buscando");
  const lista = page.getByTestId("shifts-panel-list");
  await expect(lista.locator('[data-family="buscando"]')).toContainText("Todavía no tenés turnos buscando personal");
  await expect(lista.locator(".app-banda")).toHaveCount(0);
});

test("de noche el papel de la comanda sigue claro y el relieve se despega de la banda", async ({ page }) => {
  await setTheme(page, "dark");
  await panel(page, TURNOS);
  await page.goto("/shifts");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const comanda = page.locator('.app-banda [data-shift-id="s2"]');
  await expect(comanda).toHaveCSS("background-color", "rgb(238, 243, 246)");
  const colores = await comanda.evaluate((el) => ({
    relieve: getComputedStyle(el).boxShadow,
    banda: getComputedStyle(el.closest(".app-banda") as HTMLElement).backgroundColor,
  }));
  expect(colores.banda).toBe("rgb(15, 58, 91)");
  expect(colores.relieve).toContain("rgb(46, 110, 153)");
});

test("«Publicar turno» es el botón con relieve y lleva a publicar", async ({ page }) => {
  await panel(page, TURNOS);
  await page.goto("/shifts");
  const publicar = page.getByRole("link", { name: "Publicar turno" });
  await expect(publicar).toHaveClass(/boton-relieve/);
  await expect(publicar).toHaveAttribute("href", "/shifts/new");
  const sombra = await publicar.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(sombra).toContain("3px 3px 0px");
  // El principal de adentro de la comanda lleva el mismo relieve: plano al
  // lado de «Publicar turno» era el que desentonaba (Julieta, 2026-11-18).
  const elegir = page.locator('[data-shift-id="s1"]').getByRole("link", { name: /Elegir a alguien/ });
  await expect(elegir).toHaveClass(/boton-relieve/);
  expect(await elegir.evaluate((el) => getComputedStyle(el).boxShadow)).toContain("3px 3px 0px");
  // Y los secundarios siguen planos, que es lo que hace que el principal se vea.
  const mas = page.locator('[data-shift-id="s1"]').getByRole("button", { name: "Más acciones" });
  expect(await mas.evaluate((el) => getComputedStyle(el).boxShadow)).not.toContain("3px 3px 0px");
});

test("a 320 px el sello y los pasos no corren la página; el foco de adentro se ve y lo terminado queda apagado sin perder contraste", async ({ page }) => {
  // Tres cosas que encontró la revisión independiente del 2026-11-18.
  await page.setViewportSize({ width: 320, height: 800 });
  await panel(page, TURNOS);
  await page.goto("/shifts");
  await expect(page.locator('[data-shift-id="s2"]')).toBeVisible();
  const ancho = await page.evaluate(() => ({ cabe: document.documentElement.clientWidth, ocupa: document.documentElement.scrollWidth }));
  expect(ancho.ocupa).toBeLessThanOrEqual(ancho.cabe);
  // Sobre la banda el foco es blanco; adentro de la comanda, azul hondo (el papel es blanco).
  const link = page.locator('.app-banda [data-shift-id="s1"]').getByRole("link", { name: "Bar Lavalle" });
  expect(await link.evaluate((el) => getComputedStyle(el).getPropertyValue("--focus-ring").trim())).toBe("#1c5478");
  // La cancelada pierde el relieve, pero no la opacidad.
  const cancelada = page.locator('[data-shift-id="s4"]');
  await expect(cancelada).toHaveClass(/comanda-apagada/);
  await expect(cancelada).toHaveCSS("opacity", "1");
});
