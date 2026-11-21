import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

/**
 * El Panel del comercio compacto y con la tira de días
 * (docs/historial/2026-11-21-panel-compacto-con-tira.md): sin renglón de
 * pestañas, la lista agrupada por estado, el cielo bajo con el número de los
 * turnos del día, y la tira de la semana (la misma de Mis turnos) con «Más
 * adelante». Reloj fijo: jueves 19/11/2026, 18:30 en Argentina (la semana del
 * 16 al 22). Las fechas son absolutas, así que el spec no depende del día en
 * que corra.
 */
const SESSION = { id: "u-e", email: "e@oido.test", full_name: "Julieta Demo", role: "employer", status: "activo", is_active: true, is_verified: true };
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const AHORA = new Date("2026-11-19T18:30:00-03:00");
const a = (dia: string, hora = "21:00") => `${dia}T${hora}:00-03:00`;

function turno(id: string, status: string, position: string, dia: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    company_id: "c1",
    position,
    quantity: 1,
    start_at: a(dia),
    end_at: a(dia, "23:30"),
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
    created_at: "2026-11-01T12:00:00-03:00",
    company_name: "Bar Lavalle",
    company_logo_url: null,
    ...extra,
  };
}

/** Jueves de hoy: uno buscando con 4 postulados, uno cubierto, uno pagado. El sábado, dos (uno sin cubrir). */
const TURNOS = () => [
  turno("h1", "publicado", "mozo", "2026-11-19", { pending_applicants_count: 4, urgent: true }),
  turno("h2", "confirmado", "bartender", "2026-11-19", { worker_name: "Camila Rojas" }),
  turno("h3", "pagado", "barista", "2026-11-19", { worker_name: "Tomás Ruiz", start_at: a("2026-11-19", "09:00"), end_at: a("2026-11-19", "13:00") }),
  turno("s1", "publicado", "cocinero", "2026-11-21", { pending_applicants_count: 0 }),
  turno("s2", "confirmado", "runner", "2026-11-21", { worker_name: "Lucía Paz" }),
  turno("x1", "cancelado", "mozo", "2026-11-18"),
  // La semana anterior (sólo se llega con «‹»).
  turno("ant", "pagado", "mozo", "2026-11-13", { worker_name: "Tomás Ruiz" }),
  // Semanas que vienen: 23/11, 25/11 (buscando), 27/11, 4/12 (buscando) y 18/12.
  turno("f1", "confirmado", "mozo", "2026-11-23", { worker_name: "Ana Soto" }),
  turno("f2", "publicado", "cocinero", "2026-11-25", { pending_applicants_count: 0 }),
  turno("f3", "confirmado", "bartender", "2026-11-27", { worker_name: "Ana Soto" }),
  turno("f4", "buscando_personal", "mozo", "2026-12-04", { pending_applicants_count: 0 }),
  turno("f5", "confirmado", "runner", "2026-12-18", { worker_name: "Ana Soto" }),
];

async function abrir(page: Page, turnos: unknown[] = TURNOS(), url = "/shifts") {
  await page.clock.setFixedTime(AHORA);
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  // Catch-all primero: Playwright resuelve la última ruta registrada.
  await page.route("**/api/v1/**", (r) => (r.request().method() === "GET" ? r.fulfill(json([])) : r.continue()));
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json(SESSION)));
  await page.route("**/api/v1/shifts/me", (r) => r.fulfill(json(turnos)));
  await page.goto(url);
  await expect(page.getByTestId("panel-cielo")).toBeVisible();
  if (turnos.length > 0) await expect(page.getByTestId("semana-tira")).toBeVisible();
}

const visibles = (page: Page) => page.locator("[data-shift-id]");
const ids = async (page: Page) => (await visibles(page).evaluateAll((els) => els.map((e) => e.getAttribute("data-shift-id")))).sort();
const dia = (page: Page, nombre: RegExp | string) => page.getByRole("button", { name: nombre });
const titulo = (page: Page) => page.getByTestId("panel-titulo");
// El ámbar de la pantalla: lo que lleva `.boton-relieve`.
const ambares = (page: Page) => page.locator("main a.boton-relieve:visible, main button.boton-relieve:visible");
const sinScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("se fue el renglón de pestañas: la lista va agrupada por estado, sin los grupos vacíos", async ({ page }) => {
  await abrir(page);
  for (const nombre of ["Todos", /^Buscando \(/, /^En marcha \(/, /^Terminados \(/, /^Cancelados \(/]) {
    await expect(page.getByRole("button", { name: nombre })).toHaveCount(0);
  }
  await expect(page.locator('[data-tour="shifts-tabs"]')).toHaveCount(0);
  const grupos = await page.locator("[data-family]").evaluateAll((els) => els.map((e) => [e.getAttribute("data-family"), e.querySelector("h2")?.textContent]));
  expect(grupos).toEqual([
    ["buscando", "Buscando personal2"],
    ["en_marcha", "En marcha2"],
    ["terminado", "Terminados1"],
    ["cancelado", "Cancelados1"],
  ]);
  await expect(page.locator('[data-family="borrador"]')).toHaveCount(0);
  expect(await ids(page)).toEqual(["h1", "h2", "h3", "s1", "s2", "x1"]);
});

test("el cielo cuenta los turnos de hoy en una línea, con cuántos están sin cubrir", async ({ page }) => {
  await abrir(page);
  await expect(page.getByTestId("panel-cielo")).toHaveAttribute("data-cielo", "hondo");
  await expect(titulo(page)).toContainText("Hola, Julieta. Hoy tenés 3 turnos");
  await expect(page.getByTestId("panel-sin-cubrir")).toHaveText("1 sin cubrir");
  // Sin los tres contadores de antes.
  await expect(page.getByTestId("panel-estados")).toHaveCount(0);
  await expect(page.getByTestId("panel-cielo").getByText("Marchando")).toBeVisible();
  // El saludo y el número son una sola línea (el chip de «sin cubrir» queda a su lado).
  const caja = await page.getByTestId("panel-titulo").locator("span").first().boundingBox();
  expect(caja!.height).toBeLessThan(34);
});

test("«Evento» es un chip chico en la fila del estado, a la derecha de «Marchando»", async ({ page }) => {
  await abrir(page);
  const cielo = page.getByTestId("panel-cielo");
  const marchando = await cielo.getByText("Marchando").boundingBox();
  const evento = cielo.getByRole("link", { name: "Evento" });
  await expect(evento).toHaveAttribute("href", "/shifts/new-event");
  const e = (await evento.boundingBox())!;
  expect(Math.abs(e.y + e.height / 2 - (marchando!.y + marchando!.height / 2))).toBeLessThan(6);
  expect(e.x).toBeGreaterThan(marchando!.x + marchando!.width);
  expect(e.height).toBeLessThan(40);
});

test("con acción pendiente: el turno a la izquierda y el ámbar a la derecha, en una fila; «Publicar turno» no está en el cielo", async ({ page }) => {
  await abrir(page);
  const elegir = page.getByTestId("panel-elegir");
  await expect(elegir).toContainText("Mozo/a, hoy a las 21:00");
  await expect(elegir).toContainText("Ya se postularon 4");
  const boton = elegir.getByRole("link", { name: "Elegir a quién va" });
  await expect(boton).toHaveAttribute("href", "/shifts/h1/candidates");
  const texto = (await elegir.locator("p").first().boundingBox())!;
  const b = (await boton.boundingBox())!;
  expect(b.x).toBeGreaterThan(texto.x + texto.width - 1);
  expect(Math.abs(b.y + b.height / 2 - (texto.y + (await elegir.boundingBox())!.height / 2))).toBeLessThan(40);
  expect((await elegir.boundingBox())!.height).toBeLessThan(90);
  // El único ámbar de la pantalla.
  await expect(ambares(page)).toHaveCount(1);
  expect(await boton.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain("rgb(246, 169, 42)");
  await expect(page.getByTestId("panel-cielo").getByRole("link", { name: "Publicar turno" })).toHaveCount(0);
  await expect(page.locator(".barra-app").getByRole("link", { name: "Publicar turno" })).toBeVisible();
});

test("sin acción pendiente no hay «Publicar turno» en el cielo y no queda ningún ámbar (el «+» de la barra es azul)", async ({ page }) => {
  await abrir(page, [turno("c1", "confirmado", "mozo", "2026-11-19", { worker_name: "Camila Rojas" })]);
  await expect(titulo(page)).toContainText("Hoy tenés 1 turno");
  await expect(page.getByTestId("panel-sin-cubrir")).toHaveCount(0);
  await expect(page.getByTestId("panel-elegir")).toHaveCount(0);
  await expect(page.getByTestId("panel-nadie")).toHaveCount(0);
  await expect(page.getByTestId("panel-cielo").getByRole("link", { name: "Publicar turno" })).toHaveCount(0);
  await expect(ambares(page)).toHaveCount(0);
  await expect(page.locator(".barra-app").getByRole("link", { name: "Publicar turno" })).toHaveAttribute("href", "/shifts/new");
});

test("si nadie se postuló el cielo lo dice, sin botón de publicar", async ({ page }) => {
  await abrir(page, [turno("b1", "publicado", "cocinero", "2026-11-19", { pending_applicants_count: 0 })]);
  await expect(titulo(page)).toContainText("Hoy tenés 1 turno");
  await expect(page.getByTestId("panel-sin-cubrir")).toHaveText("1 sin cubrir");
  const nadie = page.getByTestId("panel-nadie");
  await expect(nadie).toContainText("Cocinero/a, hoy a las 21:00");
  await expect(nadie).toContainText("Todavía nadie cantó «oído»");
  await expect(page.getByTestId("panel-cielo").getByRole("link", { name: "Publicar turno" })).toHaveCount(0);
  await expect(ambares(page)).toHaveCount(0);
});

test("hoy sin turnos: «Hoy no tenés turnos» y debajo el próximo", async ({ page }) => {
  await abrir(page, TURNOS().filter((t) => !["h1", "h2", "h3"].includes(t.id)));
  await expect(titulo(page)).toContainText("Hola, Julieta. Hoy no tenés turnos");
  // Lo próximo en curso es el del sábado 21.
  await expect(page.getByTestId("panel-proximo")).toHaveText("El próximo es el sábado");
  await expect(page.getByTestId("panel-sin-cubrir")).toHaveCount(0);
});

test("hoy sin turnos y sin ninguno que venga: no hay línea del próximo", async ({ page }) => {
  await abrir(page, [turno("ant", "pagado", "mozo", "2026-11-17")]);
  await expect(titulo(page)).toContainText("Hoy no tenés turnos");
  await expect(page.getByTestId("panel-proximo")).toHaveCount(0);
  // Con historia pero nada en curso es el cielo de día y la lista muestra lo que pasó (en su semana).
  await expect(page.getByTestId("panel-cielo")).toHaveAttribute("data-cielo", "dia");
  await expect(page.locator('[data-shift-id="ant"]')).toBeVisible();
  await expect(page.getByTestId("panel-cielo").getByRole("link", { name: "Publicar turno" })).toHaveCount(0);
});

test("elegir un día cambia el número y la lista; tocarlo otra vez vuelve a hoy y a la semana", async ({ page }) => {
  await abrir(page);
  await dia(page, "sábado 21, 2 turnos").click();
  await expect(dia(page, "sábado 21, 2 turnos")).toHaveAttribute("aria-pressed", "true");
  await expect(titulo(page)).toContainText("El sábado tenés 2 turnos");
  await expect(titulo(page)).not.toContainText("Hola");
  await expect(page.getByTestId("panel-sin-cubrir")).toHaveText("1 sin cubrir");
  expect(await ids(page)).toEqual(["s1", "s2"]);
  await expect(page.locator("[data-family]")).toHaveCount(2);
  // La acción pendiente del cielo no depende del día que se mira.
  await expect(page.getByTestId("panel-elegir")).toContainText("Ya se postularon 4");
  await dia(page, "sábado 21, 2 turnos").click();
  await expect(titulo(page)).toContainText("Hola, Julieta. Hoy tenés 3 turnos");
  expect(await ids(page)).toEqual(["h1", "h2", "h3", "s1", "s2", "x1"]);
});

test("un día sin turnos: «Nada el martes 17» y el cielo dice que no tenés turnos ese día", async ({ page }) => {
  await abrir(page);
  await dia(page, "martes 17").click();
  await expect(page.getByTestId("dia-vacio")).toHaveText("Nada el martes 17");
  // Es un día que ya pasó: va en pasado.
  await expect(titulo(page)).toContainText("El martes no tuviste turnos");
  await expect(page.getByTestId("panel-proximo")).toHaveCount(0);
  await expect(visibles(page)).toHaveCount(0);
  await expect(page.getByTestId("mas-adelante")).toBeVisible();
  // Uno que viene, vacío: en presente y con «Mañana».
  await dia(page, "viernes 20").click();
  await expect(page.getByTestId("dia-vacio")).toHaveText("Nada el viernes 20");
  await expect(titulo(page)).toContainText("Mañana no tenés turnos");
});

test("las flechas pasan de semana, el número vuelve a hoy y «Volver a esta semana» regresa", async ({ page }) => {
  await abrir(page);
  await expect(page.getByRole("button", { name: "Semana anterior, con turnos" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Semana siguiente, con turnos" })).toBeVisible();
  await dia(page, "sábado 21, 2 turnos").click();
  await page.getByRole("button", { name: /^Semana siguiente/ }).click();
  await expect(page.getByText("Semana · 23 – 29 nov")).toBeVisible();
  expect(await ids(page)).toEqual(["f1", "f2", "f3"]);
  // Al cambiar de semana se suelta el día elegido: el número vuelve a ser el de hoy.
  await expect(titulo(page)).toContainText("Hoy tenés 3 turnos");
  await expect(page.locator('[data-dia] button[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator('[data-family="buscando"]')).toHaveCount(1);
  await page.getByRole("button", { name: "Volver a esta semana" }).click();
  await expect(page.getByText("Esta semana · 16 – 22 nov")).toBeVisible();
  expect(await ids(page)).toEqual(["h1", "h2", "h3", "s1", "s2", "x1"]);
  // Hacia atrás, lo que ya pasó.
  await page.getByRole("button", { name: /^Semana anterior/ }).click();
  expect(await ids(page)).toEqual(["ant"]);
  await expect(page.locator('[data-family="terminado"]')).toBeVisible();
});

test("«Más adelante» va al final, con los «Buscando» primero, y tocar una fila salta a su semana con ese día elegido", async ({ page }) => {
  await abrir(page);
  const mas = page.getByTestId("mas-adelante");
  await expect(mas).toBeVisible();
  // El último bloque de la lista: después de los grupos.
  const orden = await page.evaluate(() => {
    const lista = document.querySelector('[data-testid="shifts-panel-list"]')!.getBoundingClientRect();
    return document.querySelector('[data-testid="mas-adelante"]')!.getBoundingClientRect().top >= lista.bottom;
  });
  expect(orden).toBe(true);
  // Cinco turnos futuros: primero los que buscan (25/11 y 4/12), después por fecha.
  await expect(mas.getByRole("heading", { name: /Más adelante/ })).toContainText("5");
  const filas = mas.getByRole("listitem");
  await expect(filas).toHaveCount(3);
  await expect(filas.nth(0)).toContainText("mié 25 nov");
  await expect(filas.nth(0)).toContainText("Buscando");
  await expect(filas.nth(1)).toContainText("vie 4 dic");
  await expect(filas.nth(1)).toContainText("Buscando");
  await expect(filas.nth(2)).toContainText("lun 23 nov");
  await mas.getByRole("button", { name: /Ver los 2 que siguen/ }).click();
  await expect(filas).toHaveCount(5);
  await expect(filas.nth(3)).toContainText("vie 27 nov");
  await expect(filas.nth(4)).toContainText("vie 18 dic");
  // Tocar una fila: su semana, con el día elegido y el número de ese día.
  await filas.nth(0).getByRole("button").click();
  await expect(page.getByText("Semana · 23 – 29 nov")).toBeVisible();
  await expect(dia(page, "miércoles 25, 1 turno")).toHaveAttribute("aria-pressed", "true");
  expect(await ids(page)).toEqual(["f2"]);
  await expect(titulo(page)).toContainText("El miércoles tenés 1 turno");
  await expect(page.getByTestId("panel-sin-cubrir")).toHaveText("1 sin cubrir");
});

test("el primer turno se ve entero sin bajar, a 390×844, con su título de grupo", async ({ page }) => {
  await abrir(page);
  const titulo1 = page.locator('[data-family="buscando"] h2');
  const primero = page.locator('[data-shift-id="h1"]');
  await expect(primero).toBeVisible();
  const barra = (await page.locator(".barra-app").boundingBox())!;
  const t = (await titulo1.boundingBox())!;
  const p = (await primero.boundingBox())!;
  expect(t.y).toBeGreaterThanOrEqual(0);
  expect(p.y + p.height).toBeLessThanOrEqual(barra.y);
  expect(p.y + p.height).toBeLessThanOrEqual(844);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test("el Panel vacío (ningún turno) sí lleva «Publicar turno» en el cielo, con la bienvenida", async ({ page }) => {
  await abrir(page, []);
  await expect(page.getByTestId("panel-cielo")).toHaveAttribute("data-cielo", "dia");
  await expect(titulo(page)).toContainText("¿Te falta alguien hoy?");
  await expect(page.getByTestId("panel-cielo").getByText("Pedilo como lo dirías en la cocina.")).toBeVisible();
  const publicar = page.getByTestId("panel-cielo").getByRole("link", { name: "Publicar turno" });
  await expect(publicar).toHaveAttribute("href", "/shifts/new");
  await expect(ambares(page)).toHaveCount(1);
  await expect(page.getByTestId("panel-cielo").getByRole("link", { name: "Evento" })).toBeVisible();
  await expect(page.getByTestId("panel-primer-dia")).toContainText("Cantás el pedido");
  // Sin turnos no hay tira ni «Más adelante».
  await expect(page.getByTestId("semana-tira")).toHaveCount(0);
  await expect(page.getByTestId("mas-adelante")).toHaveCount(0);
});

test("un enlace con ?tab=buscando salta a la semana del turno y baja hasta su grupo", async ({ page }) => {
  // Buscando sólo hay en las semanas que vienen: 25/11.
  await abrir(
    page,
    TURNOS().filter((t) => t.id !== "h1" && t.id !== "s1"),
    "/shifts?tab=buscando"
  );
  await expect(page.getByText("Semana · 23 – 29 nov")).toBeVisible();
  const grupo = page.locator('[data-family="buscando"]');
  await expect(grupo).toBeVisible();
  await expect(grupo.locator('[data-shift-id="f2"]')).toBeVisible();
  await expect(page).toHaveURL(/\/shifts$/);
  await expect
    .poll(() => grupo.evaluate((el) => el.getBoundingClientRect().top < window.innerHeight && el.getBoundingClientRect().bottom > 0))
    .toBe(true);
});

test("un enlace con ?tab=terminado sin salir de la semana baja hasta ese grupo", async ({ page }) => {
  await abrir(page, TURNOS(), "/shifts?tab=cancelado");
  await expect(page.getByText("Esta semana · 16 – 22 nov")).toBeVisible();
  await expect(page).toHaveURL(/\/shifts$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect(page.locator('[data-family="cancelado"] h2')).toBeInViewport();
});

for (const theme of ["light", "dark"] as const) {
  for (const ancho of [320, 390]) {
    test(`${theme} a ${ancho} px: el cielo, un día elegido y «Más adelante» no corren la página`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: 800 });
      await setTheme(page, theme);
      await abrir(page);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      expect(await sinScroll(page)).toBe(true);
      await dia(page, "sábado 21, 2 turnos").click();
      expect(await sinScroll(page)).toBe(true);
      await page.getByTestId("mas-adelante").getByRole("button", { name: /Ver los/ }).click();
      expect(await sinScroll(page)).toBe(true);
      await page.getByRole("button", { name: /^Semana siguiente/ }).click();
      expect(await sinScroll(page)).toBe(true);
      await expect(ambares(page)).toHaveCount(1);
    });
  }
}

test("de noche el único ámbar sigue siendo «Elegir a quién va» y el cielo es el azul hondo", async ({ page }) => {
  await setTheme(page, "dark");
  await abrir(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.getByTestId("panel-cielo").evaluate((el) => getComputedStyle(el).backgroundImage)).toContain("rgb(11, 26, 40)");
  await expect(ambares(page)).toHaveCount(1);
  await expect(ambares(page)).toHaveText("Elegir a quién va");
});

test("con la letra al 200 % el cielo y la tira se leen y no se salen", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.fontSize = "32px";
    });
  });
  await abrir(page);
  expect(await sinScroll(page)).toBe(true);
  await expect(titulo(page)).toContainText("Hoy tenés 3 turnos");
  await expect(page.getByTestId("panel-elegir").getByRole("link", { name: "Elegir a quién va" })).toBeVisible();
  // Todo lo que se toca en el cielo queda dentro del ancho de la pantalla.
  const fuera = await page.getByTestId("panel-cielo").evaluate((c) => {
    const w = window.innerWidth;
    return [...c.querySelectorAll("a, button")].filter((e) => e.getBoundingClientRect().right > w + 1).length;
  });
  expect(fuera).toBe(0);
});

test("en la compu (1280) el cielo y la tira van en el ancho del panel, con lo que se elige a la derecha", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await abrir(page);
  const cielo = (await page.getByTestId("panel-cielo").boundingBox())!;
  const tira = (await page.getByTestId("semana-tira").boundingBox())!;
  const elegir = (await page.getByTestId("panel-elegir").boundingBox())!;
  const tit = (await titulo(page).boundingBox())!;
  expect(tira.x).toBeGreaterThanOrEqual(cielo.x);
  expect(tira.x + tira.width).toBeLessThanOrEqual(cielo.x + cielo.width);
  // El turno por elegir a la derecha del título, en la otra columna.
  expect(elegir.x).toBeGreaterThan(tit.x + 200);
  // La tira queda debajo y entra con sus siete días a la vista.
  expect(tira.y).toBeGreaterThan(elegir.y);
  expect(await sinScroll(page)).toBe(true);
  await expect(page.getByRole("list", { name: "Días de la semana" }).getByRole("button")).toHaveCount(7);
  // Y la lista, en la hoja.
  await expect(page.locator('[data-shift-id="h1"]')).toBeVisible();
});
