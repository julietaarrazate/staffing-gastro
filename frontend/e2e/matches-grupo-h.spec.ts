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

test("turno confirmado: el ámbar va en la acción que se puede usar ahora (tres tramos)", async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: -34.58, longitude: -58.42 });
  const en = (min: number) => new Date(Date.now() + min * 60 * 1000).toISOString();
  await abrir(page, [], [
    shift({ id: "lejos", status: "confirmado", start_at: isoEnDias(2), company_name: "Bar Demo", worker_profile_id: "p" }),
    shift({ id: "camino", status: "confirmado", start_at: en(60), company_name: "Café Belgrano", worker_profile_id: "p" }),
    shift({ id: "ahora", status: "confirmado", start_at: en(10), company_name: "Bodegón Sur", worker_profile_id: "p" }),
  ]);
  await page.route("**/api/v1/shifts/*/en-route", (r) => r.fulfill(json({})));
  const boton = (id: string, name: string) => page.locator(`#turno-${id}`).getByRole("button", { name });
  // Más de 2 h antes: ninguno en ámbar y «Llegué» deshabilitado con su pista.
  expect(await esAmbar(boton("lejos", "Voy en camino"))).toBe(false);
  expect(await esAmbar(boton("lejos", "Llegué"))).toBe(false);
  await expect(boton("lejos", "Llegué")).toBeDisabled();
  await expect(page.locator("#turno-lejos").getByText("Se habilita 30 min antes del turno.")).toBeVisible();
  // De 2 h a 30 min: «Voy en camino» ámbar; «Llegué» sigue deshabilitado.
  expect(await esAmbar(boton("camino", "Voy en camino"))).toBe(true);
  expect(await esAmbar(boton("camino", "Llegué"))).toBe(false);
  await expect(boton("camino", "Llegué")).toBeDisabled();
  // Ya compartiendo: ninguno en ámbar.
  await boton("camino", "Voy en camino").click();
  await expect(boton("camino", "Dejar de compartir")).toBeVisible();
  expect(await esAmbar(boton("camino", "Dejar de compartir"))).toBe(false);
  expect(await esAmbar(boton("camino", "Llegué"))).toBe(false);
  // Desde 30 min antes: «Llegué» ámbar y habilitado, sin pista.
  expect(await esAmbar(boton("ahora", "Llegué"))).toBe(true);
  await expect(boton("ahora", "Llegué")).toBeEnabled();
  expect(await esAmbar(boton("ahora", "Voy en camino"))).toBe(false);
  await expect(page.locator("#turno-ahora").getByText("Se habilita 30 min antes del turno.")).toHaveCount(0);
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
  // El parámetro se saca de la URL: una recarga no vuelve a saltar.
  await expect(page).toHaveURL(/\/my-shifts$/);
  await expect(tarjeta).not.toHaveClass(/ring-primary-text/, { timeout: 6000 });
});

test("?turno= estando ya en Matches (aviso tocado desde la campanita) salta otra vez", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const muchos = Array.from({ length: 8 }, (_, i) =>
    shift({ id: `turno-${i}`, status: "confirmado", start_at: isoEnDias(2 + i), worker_profile_id: "p", company_name: `Local ${i}` }),
  );
  await abrir(page, [], muchos, [], "/my-shifts?turno=turno-7");
  await expect(page.locator("#turno-turno-7")).toHaveClass(/ring-primary-text/);
  await expect(page).toHaveURL(/\/my-shifts$/);
  // Mismo recorrido que la navegación de la campanita: cambia sólo la query.
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    window.history.pushState(null, "", "/my-shifts?turno=turno-6");
  });
  await expect(page.locator("#turno-turno-6")).toHaveClass(/ring-primary-text/);
  await expect(page.locator("#turno-turno-6")).toBeInViewport();
  await expect(page).toHaveURL(/\/my-shifts$/);
});

test("?turno= con un turno que no está en la lista no pasa nada", async ({ page }) => {
  await abrir(page, [], assigned, [], "/my-shifts?turno=no-existe");
  await expect(page.getByRole("heading", { name: "Matches" })).toBeVisible();
  await expect(page.locator("[class*='ring-primary-text']")).toHaveCount(0);
});
