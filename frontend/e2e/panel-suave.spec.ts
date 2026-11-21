import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, isoEnDias, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

/**
 * El panel del comercio con la dirección suave (ADR-0028, 2026-11-20,
 * docs/historial/2026-11-20-panel-comercio-direccion-suave.md; maquetas
 * `C-Panel`, `C-Panel-vacio` y `C-Panel-nadie`): arriba el cielo, hondo
 * mientras hay turnos en curso, con el número de turnos de hoy y sus tres
 * estados; debajo la hoja con los turnos como filas suaves. Un solo ámbar.
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

const HOY = { start_at: isoEnDias(0, "23:00"), end_at: isoEnDias(1, "02:00") };
const TURNOS = [
  shift("s1", "publicado", "mozo", { urgent: true, pending_applicants_count: 4, ...HOY }),
  shift("s2", "confirmado", "bartender", { worker_name: "Camila Rojas", ...HOY }),
  shift("s3", "finalizado", "barista", { worker_name: "Tomás Ruiz", ...HOY }),
  shift("s4", "cancelado", "runner", HOY),
];
// El ámbar de la pantalla: lo que lleva `.boton-relieve` (dentro de
// `.estilo-suave`, el degradé ámbar).
const ambares = (page: Page) => page.locator("main a.boton-relieve:visible, main button.boton-relieve:visible");

test("el cielo hondo dice cuántos turnos hay hoy y sus tres estados; debajo, la hoja con las filas", async ({ page }) => {
  await panel(page, TURNOS);
  await page.goto("/shifts");
  const cielo = page.getByTestId("panel-cielo");
  await expect(cielo).toHaveAttribute("data-cielo", "hondo");
  await expect(cielo).toHaveClass(/cielo-hondo/);
  await expect(cielo).toHaveCSS("color", "rgb(255, 255, 255)");
  // El título saluda y termina en el número (los cancelados no cuentan).
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Hola, Julieta\. Hoy tenés\s+3\s*turnos$/);
  await expect(cielo.getByTestId("panel-estados")).toHaveText(/1\s*Buscando.*1\s*En marcha.*1\s*Terminados|Buscando\s*1.*En marcha\s*1.*Terminados\s*1/);
  await expect(cielo.getByText("Marchando")).toBeVisible();
  // La hoja sube sobre el cielo y lleva las familias, sin riel ni comandas.
  const lista = page.getByTestId("shifts-panel-list");
  await expect(page.locator(".hoja")).toBeVisible();
  for (const familia of ["buscando", "en_marcha", "terminado", "cancelado"]) {
    await expect(lista.locator(`[data-family="${familia}"]`)).toBeVisible();
  }
  await expect(page.locator(".app-banda, .riel, .comanda, .sello-goma, .letra-cartel")).toHaveCount(0);
  const urgente = lista.locator('[data-shift-id="s1"]');
  await expect(urgente).toHaveClass(/turno-fila/);
  await expect(urgente.getByRole("heading", { name: /Mozo\/a/ })).toBeVisible();
  await expect(urgente).toContainText("Urgente");
  await expect(urgente.getByTestId("shift-status")).toHaveText("Publicado");
  // Sin foto ni persona va el cielo con el ícono del puesto, no el color del rubro.
  await expect(urgente.locator('[data-portada="mini"]')).toBeVisible();
  // Con persona asignada, sus iniciales y su nombre.
  const cubierto = lista.locator('[data-shift-id="s2"]');
  await expect(cubierto).toContainText("Camila Rojas");
  await expect(cubierto.locator('[data-portada="mini"]')).toHaveCount(0);
});

test("un solo ámbar: «Elegir a quién va» en el cielo; «Publicar turno» queda en el «+» de la barra y las filas van en azul hondo", async ({ page }) => {
  await panel(page, TURNOS);
  await page.goto("/shifts");
  const elegir = page.getByTestId("panel-elegir");
  await expect(elegir).toContainText("Mozo/a, hoy a las 23:00");
  await expect(elegir).toContainText("Ya se postularon 4");
  await expect(ambares(page)).toHaveCount(1);
  const ambar = elegir.getByRole("link", { name: "Elegir a quién va" });
  await expect(ambar).toHaveClass(/boton-relieve/);
  await expect(ambar).toHaveAttribute("href", "/shifts/s1/candidates");
  expect(await ambar.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain("rgb(246, 169, 42)");
  // Con a quién elegir, publicar no va en el cielo: queda el «+» al lado de la
  // barra de abajo, que no es ámbar de relieve.
  await expect(page.getByTestId("panel-cielo").getByRole("link", { name: "Publicar turno" })).toHaveCount(0);
  const publicar = page.locator(".barra-app").getByRole("link", { name: "Publicar turno" });
  await expect(publicar).toHaveAttribute("href", "/shifts/new");
  await expect(publicar).not.toHaveClass(/boton-relieve/);
  await expect(page.getByTestId("panel-cielo").getByRole("link", { name: "Evento" })).toHaveAttribute("href", "/shifts/new-event");
  // La acción de cada fila sigue ahí, en azul hondo con letra blanca.
  const deLaFila = page.locator('[data-shift-id="s1"]').getByRole("link", { name: "Elegir a alguien (4)" });
  await expect(deLaFila).toHaveClass(/boton-hondo/);
  await expect(deLaFila).toHaveCSS("color", "rgb(255, 255, 255)");
  expect(await deLaFila.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain("rgb(42, 115, 163)");
  const pagar = page.locator('[data-shift-id="s3"]').getByRole("button", { name: "Marcar como pagado" });
  await expect(pagar).toHaveClass(/boton-hondo/);
  await expect(pagar).not.toHaveClass(/boton-relieve/);
});

test("nadie se postuló: el cielo lo dice y el ámbar vuelve a «Publicar turno»", async ({ page }) => {
  await panel(page, [shift("s1", "publicado", "cocinero", { pending_applicants_count: 0, ...HOY })]);
  await page.goto("/shifts");
  const cielo = page.getByTestId("panel-cielo");
  await expect(cielo).toHaveAttribute("data-cielo", "hondo");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Hoy tenés\s+1\s*turno$/);
  await expect(cielo.getByTestId("panel-nadie")).toContainText("Cocinero/a, hoy a las 23:00");
  await expect(cielo.getByTestId("panel-nadie")).toContainText("Todavía nadie cantó «oído»");
  await expect(page.getByTestId("panel-elegir")).toHaveCount(0);
  await expect(ambares(page)).toHaveCount(1);
  await expect(ambares(page)).toHaveText(/Publicar turno/);
});

test("el primer día: el cielo de día pregunta «¿Te falta alguien hoy?» y la hoja cuenta cómo sale un turno", async ({ page }) => {
  await panel(page, []);
  await page.goto("/shifts");
  const cielo = page.getByTestId("panel-cielo");
  await expect(cielo).toHaveAttribute("data-cielo", "dia");
  await expect(cielo).not.toHaveClass(/cielo-hondo/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hola, Julieta. ¿Te falta alguien hoy?");
  await expect(ambares(page)).toHaveCount(1);
  await expect(ambares(page)).toHaveAttribute("href", "/shifts/new");
  const pasos = page.getByTestId("panel-primer-dia");
  await expect(pasos.getByRole("heading", { name: "Así sale un turno" })).toBeVisible();
  await expect(pasos.getByRole("listitem")).toHaveCount(3);
  await expect(pasos).toContainText("Cantás el pedido");
  await expect(page.getByTestId("shifts-panel-list")).toHaveCount(0);
});

test("sin nada en curso pero con historia: cielo de día y la lista con lo que ya pasó", async ({ page }) => {
  await panel(page, [shift("s3", "pagado", "barista", { worker_name: "Tomás Ruiz" })]);
  await page.goto("/shifts");
  await expect(page.getByTestId("panel-cielo")).toHaveAttribute("data-cielo", "dia");
  await expect(page.getByTestId("panel-primer-dia")).toHaveCount(0);
  await expect(page.locator('[data-shift-id="s3"]')).toHaveClass(/turno-apagado/);
  await expect(page.locator('[data-shift-id="s3"]')).toHaveCSS("opacity", "1");
});

test("una pestaña sin turnos muestra su cartel de vacío en la hoja", async ({ page }) => {
  await panel(page, [shift("s3", "finalizado", "barista")]);
  await page.goto("/shifts?tab=buscando");
  await expect(page.locator('.hoja [data-family="buscando"]')).toContainText("Todavía no tenés turnos buscando personal");
});

test("de noche el cielo es el azul hondo de la noche y las filas se despegan de la hoja", async ({ page }) => {
  await setTheme(page, "dark");
  await panel(page, TURNOS);
  await page.goto("/shifts");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const cielo = page.getByTestId("panel-cielo");
  expect(await cielo.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain("rgb(11, 26, 40)");
  const colores = await page.locator('[data-shift-id="s2"]').evaluate((el) => ({
    fila: getComputedStyle(el).backgroundColor,
    hoja: getComputedStyle(el.closest(".hoja") as HTMLElement).backgroundColor,
  }));
  expect(colores.fila).toBe("rgb(29, 40, 51)");
  expect(colores.fila).not.toBe(colores.hoja);
  await expect(ambares(page)).toHaveCount(1);
});

test("a 320 px nada corre la página y el foco sobre el cielo hondo es blanco", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await panel(page, TURNOS);
  await page.goto("/shifts");
  await expect(page.locator('[data-shift-id="s2"]')).toBeVisible();
  const ancho = await page.evaluate(() => ({ cabe: document.documentElement.clientWidth, ocupa: document.documentElement.scrollWidth }));
  expect(ancho.ocupa).toBeLessThanOrEqual(ancho.cabe);
  // Con «Elegir a quién va» el cielo sólo trae «Evento» (publicar queda en el «+»
  // de la barra de abajo), que sigue sobre el cielo hondo.
  const evento = page.getByTestId("panel-cielo").getByRole("link", { name: "Evento" });
  expect(await evento.evaluate((el) => getComputedStyle(el).getPropertyValue("--focus-ring").trim())).toMatch(/^#fff(fff)?$/i);
  // Adentro de la hoja, el de siempre.
  const mas = page.locator('[data-shift-id="s1"]').getByRole("button", { name: "Más acciones" });
  expect(await mas.evaluate((el) => getComputedStyle(el).getPropertyValue("--focus-ring").trim())).not.toMatch(/^#fff(fff)?$/i);
});
