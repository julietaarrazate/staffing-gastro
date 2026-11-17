/**
 * Matches del trabajador (Beta etapa 3, grupo H): «Asignados» separa lo
 * terminado (U066), las tres pestañas entran sin scroll en 360 px y sin
 * tarjetas más anchas que la pantalla (U068), y una postulación a un turno
 * cerrado no dice «esperando respuesta» (U088).
 */
import { test, expect } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash, isoEnDias } from "./mocks";

const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

function shift(o: Record<string, unknown>) {
  return {
    id: "s", company_id: "c", position: "mozo", quantity: 1,
    start_at: isoEnDias(2), end_at: isoEnDias(3, "02:00"), pay_amount: "45000", currency: "ARS",
    tips: true, meal: false, dress_code: null, urgent: false, address: null, city: "Palermo, CABA",
    latitude: -34.58, longitude: -58.42, title: null, description: null, status: "publicado",
    worker_profile_id: null, check_in_latitude: null, check_in_longitude: null, check_in_at: null,
    check_out_latitude: null, check_out_longitude: null, check_out_at: null, paid_at: null, no_show_at: null,
    last_no_show_worker_profile_id: null, event_id: null, event_name: null, created_at: isoEnDias(-1),
    company_name: "Bar Demo", company_logo_url: null, company_verified: false, ...o,
  };
}
const LONG = "Restaurante y Cervecería Artesanal Los Hermanos del Puerto de Palermo Soho";
const assigned = [
  shift({ id: "pagado1", status: "pagado", start_at: isoEnDias(-5), end_at: isoEnDias(-4, "02:00"), company_name: LONG, worker_profile_id: "p" }),
  shift({ id: "conf1", status: "confirmado", start_at: isoEnDias(1), company_name: "Café Belgrano", worker_profile_id: "p" }),
  shift({ id: "asig1", status: "asignado", start_at: isoEnDias(3), company_name: LONG, worker_profile_id: "p" }),
];
const apps = [
  { id: "a1", shift_id: "ab", worker_profile_id: "p", status: "pendiente", created_at: isoEnDias(-1), shift: shift({ id: "ab", status: "publicado", company_name: "Bar Demo" }) },
  { id: "a2", shift_id: "nc", worker_profile_id: "p", status: "pendiente", created_at: isoEnDias(-3), shift: shift({ id: "nc", status: "no_cubierto", start_at: isoEnDias(-1), company_name: "Café Belgrano" }) },
  { id: "a3", shift_id: "ca", worker_profile_id: "p", status: "pendiente", created_at: isoEnDias(-3), shift: shift({ id: "ca", status: "cancelado", company_name: "Bodegón Sur" }) },
];
const saved = [
  shift({ id: "g1", company_name: LONG }),
  shift({ id: "g2", company_name: "Café Belgrano", position: "barista" }),
  shift({ id: "g3", company_name: "Bodegón Sur", position: "cocinero" }),
];


async function abrir(
  page: import("@playwright/test").Page,
  guardados: unknown[] = saved,
  asignados: unknown[] = assigned,
  postulaciones: unknown[] = apps,
  url = "/my-shifts",
) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json({ id: "u", email: "m@x.com", full_name: "Mozo", role: "worker", status: "activo", is_active: true, is_verified: true })));
  await page.route("**/api/v1/shifts/mine", (r) => r.fulfill(json(asignados)));
  await page.route("**/api/v1/applications/mine", (r) => r.fulfill(json(postulaciones)));
  await page.route("**/api/v1/saved-shifts", (r) => r.request().method() === "GET" ? r.fulfill(json(guardados)) : r.continue());
  await page.route("**/api/v1/workers/me/profile", (r) => r.fulfill(json({ id: "p", user_id: "u", full_name: "Mozo", skills: ["mozo"], latitude: -34.58, longitude: -58.42, city: "Palermo", badges: [], level: "plata", rating: 4.5 })));
  await page.goto(url);
  await page.getByRole("heading", { name: "Matches" }).waitFor();
}

test("Asignados: lo que hay que hacer arriba y lo terminado bajo «Terminados»", async ({ page }) => {
  await abrir(page);
  const terminados = page.getByRole("heading", { name: "Terminados" });
  await expect(terminados).toBeVisible();
  const pendiente = await page.getByText("Café Belgrano").first().boundingBox();
  const heading = await terminados.boundingBox();
  expect(pendiente!.y).toBeLessThan(heading!.y);
  await expect(page.getByText("Turno pagado")).toBeVisible();
});

test("en 360 px las tres pestañas entran y la página no se desborda", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await abrir(page);
  for (const name of [/^Asignados/, /^Postulaciones/, /^Guardados/]) {
    const box = await page.getByRole("button", { name }).boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    // Contra el margen de la página (16 px), no sólo contra el borde.
    expect(box!.x + box!.width).toBeLessThanOrEqual(344);
  }
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(ancho).toBeLessThanOrEqual(360);
});

test("en 360 px con contadores de dos cifras ningún nombre se recorta", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const n = (k: number, f: (i: number) => unknown) => Array.from({ length: k }, (_, i) => f(i));
  await abrir(
    page,
    n(11, (i) => shift({ id: `guardado-${i}` })),
    n(12, (i) => shift({ id: `asignado-${i}`, status: "confirmado", worker_profile_id: "p" })),
    n(10, (i) => ({ id: `post-${i}`, shift_id: `abierto-${i}`, worker_profile_id: "p", status: "pendiente", created_at: isoEnDias(-1), shift: shift({ id: `abierto-${i}` }) })),
  );
  for (const name of ["Asignados (12)", "Postulaciones (10)", "Guardados (11)"]) {
    const recortado = await page
      .getByRole("button", { name })
      .locator(".truncate")
      .evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(recortado, name).toBe(false);
  }
});

test("en 320 px y con un contador de tres cifras la pista no desborda y el número se ve", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const muchos = Array.from({ length: 120 }, (_, i) => shift({ id: `guardado-${i}`, company_name: "Bodegón Sur" }));
  await abrir(page, muchos);
  for (const name of [/^Asignados/, /^Postulaciones/, /^Guardados/]) {
    const box = await page.getByRole("button", { name }).boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(16);
    expect(box!.x + box!.width).toBeLessThanOrEqual(304);
  }
  await expect(page.getByRole("button", { name: "Guardados (120)" }).getByText("120", { exact: true })).toBeVisible();
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(ancho).toBeLessThanOrEqual(320);
});

test("postulación a un turno cerrado dice que se cerró, no «esperando respuesta»", async ({ page }) => {
  await abrir(page);
  await page.getByRole("button", { name: /^Postulaciones/ }).click();
  await expect(page.getByText("Postulado · esperando respuesta")).toHaveCount(1);
  await expect(page.getByText("El turno se cerró sin cubrir")).toBeVisible();
  await expect(page.getByText("El comercio canceló el turno")).toBeVisible();
  // La pestaña sólo cuenta la que sigue abierta.
  await expect(page.getByRole("button", { name: "Postulaciones (1)" })).toBeVisible();
});

test("quitar una postulación de un turno cerrado avisa «Quitamos…», no «Cancelaste»", async ({ page }) => {
  await abrir(page);
  await page.route("**/api/v1/applications/*/withdraw", (r) => r.fulfill(json({})));
  await page.getByRole("button", { name: /^Postulaciones/ }).click();
  await page.getByRole("button", { name: "Quitar de la lista" }).first().click();
  await expect(page.getByText("Quitamos la postulación de tu lista")).toBeVisible();
  await expect(page.getByText("Cancelaste tu postulación")).toHaveCount(0);
});

test("quitar una postulación abierta sigue diciendo «Cancelaste tu postulación»", async ({ page }) => {
  await abrir(page);
  await page.route("**/api/v1/applications/*/withdraw", (r) => r.fulfill(json({})));
  await page.getByRole("button", { name: /^Postulaciones/ }).click();
  await page.getByRole("button", { name: "Cancelar postulación" }).click();
  await page.getByRole("button", { name: "Sí, cancelar" }).click();
  await expect(page.getByText("Cancelaste tu postulación")).toBeVisible();
});

const esAmbar = (loc: import("@playwright/test").Locator) =>
  loc.evaluate((el) => el.className.split(/\s+/).includes("bg-primary"));

test("turno confirmado: un solo botón ámbar por tarjeta, el que corresponde ahora", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const pronto = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await abrir(page, [], [
    shift({ id: "pronto", status: "confirmado", start_at: pronto, company_name: "Café Belgrano", worker_profile_id: "p" }),
    shift({ id: "lejos", status: "confirmado", start_at: isoEnDias(2), company_name: "Bar Demo", worker_profile_id: "p" }),
  ]);
  const tarjeta = (id: string) => page.locator(`#turno-${id}`);
  // Falta 1 h: ya se puede avisar que va en camino, esa es la acción de ahora.
  expect(await esAmbar(tarjeta("pronto").getByRole("button", { name: "Voy en camino" }))).toBe(true);
  expect(await esAmbar(tarjeta("pronto").getByRole("button", { name: "Llegué" }))).toBe(false);
  // Faltan 2 días: «Voy en camino» todavía no corresponde.
  expect(await esAmbar(tarjeta("lejos").getByRole("button", { name: "Voy en camino" }))).toBe(false);
  expect(await esAmbar(tarjeta("lejos").getByRole("button", { name: "Llegué" }))).toBe(true);
});

test("comparar: el círculo de selección usa el color de marca, no el ámbar", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await abrir(page);
  await page.getByRole("button", { name: /^Guardados/ }).click();
  await page.getByRole("button", { name: "Comparar" }).click();
  const circulos = page.getByRole("button", { name: "Sumar a la comparación" });
  await circulos.nth(0).click();
  await circulos.nth(0).click();
  const elegido = page.getByRole("button", { name: "Sacar de la comparación" }).first();
  await expect(elegido).toHaveAttribute("aria-pressed", "true");
  expect(await esAmbar(elegido)).toBe(false);
});

test("?turno= abre Asignados, baja a esa tarjeta y la resalta", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const muchos = Array.from({ length: 8 }, (_, i) =>
    shift({ id: `turno-${i}`, status: "confirmado", start_at: isoEnDias(2 + i), worker_profile_id: "p", company_name: `Local ${i}` }),
  );
  await abrir(page, [], muchos, [], "/my-shifts?turno=turno-7");
  const tarjeta = page.locator("#turno-turno-7");
  await expect(tarjeta).toHaveClass(/ring-primary-text/);
  await expect(tarjeta).toBeInViewport();
});

test("?turno= con un turno que no está en la lista no pasa nada", async ({ page }) => {
  await abrir(page, [], assigned, [], "/my-shifts?turno=no-existe");
  await expect(page.getByRole("heading", { name: "Matches" })).toBeVisible();
  await expect(page.locator("[class*='ring-primary-text']")).toHaveCount(0);
});
