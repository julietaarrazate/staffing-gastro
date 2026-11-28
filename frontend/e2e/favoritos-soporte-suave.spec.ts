import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";
import { deContrato } from "./contrato";

/**
 * Favoritos y Soporte con la dirección suave (ADR-0028, 2026-11-21,
 * docs/historial/2026-11-21-favoritos-y-soporte-direccion-suave.md; sin
 * maqueta): el cielo corto con el título y la vuelta, y la hoja con las
 * tarjetas suaves. Los datos y las acciones son los de antes. Renderizado, en
 * claro y de noche.
 */
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const fav = (id: string, name: string, extra: object = {}) => ({
  worker_profile_id: id, full_name: name, photo_url: null, rating: 4.5, skills: ["mozo"], is_available: false,
  events_completed: 3, shifts_together: 2, favorited_at: "2026-08-01T12:00:00-03:00", ...extra,
});
const FAVORITOS = [
  fav("w1", "Juana Pérez", { is_available: true }),
  fav("w2", "Maximiliano Alejandro Fernández Gutiérrez de la Serna", { skills: ["bartender", "barista"], shifts_together: 0 }),
];
const ticket = (id: string, subject: string, status: string) => ({
  id, user_id: "u", category: "cv_documentos", subject, status,
  created_at: "2026-11-10T12:00:00-03:00", updated_at: "2026-11-10T12:00:00-03:00",
});
const TICKETS = [ticket("t1", "No puedo subir mi CV", "abierto"), ticket("t2", "Me cobraron dos veces", "cerrado")];
const DETALLE = {
  ...TICKETS[0],
  references: null,
  messages: [
    { id: "m1", ticket_id: "t1", sender_user_id: "user-employer-1", body: "No me deja subir el PDF.", created_at: "2026-11-10T12:00:00-03:00" },
    { id: "m2", ticket_id: "t1", sender_user_id: "otro", body: "Probá con una foto.", created_at: "2026-11-10T12:20:00-03:00" },
  ],
};

type Opciones = { tema?: "light" | "dark"; rol?: "employer" | "admin"; favoritos?: unknown[]; tickets?: unknown[] };

async function abrir(page: Page, ruta: string, o: Opciones = {}) {
  const tema = o.tema ?? "light";
  await setTheme(page, tema);
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  // Catch-all primero: Playwright resuelve la última ruta registrada.
  await page.route("**/api/v1/**", (r) => (r.request().method() === "GET" ? r.fulfill(json([])) : r.continue()));
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json(deContrato(o.rol === "admin" ? "auth_me_admin" : "auth_me_employer"))));
  await page.route("**/api/v1/auth/2fa", (r) => r.fulfill(json({ enabled: true, enabled_at: null, recovery_codes_left: 8 })));
  await page.route("**/api/v1/favorites", (r) => r.fulfill(json(o.favoritos ?? FAVORITOS)));
  await page.route("**/api/v1/support/tickets/mine", (r) => r.fulfill(json(o.tickets ?? TICKETS)));
  await page.route("**/api/v1/support/tickets/t1", (r) => r.fulfill(json(DETALLE)));
  await page.goto(ruta);
  await expect(page.locator("html")).toHaveAttribute("data-theme", tema);
}

const cielo = (page: Page) => page.locator(".app-cielo");
const hoja = (page: Page) => page.locator(".hoja");
const ambares = (page: Page) =>
  page.locator("main a, main button").evaluateAll((els) =>
    els
      .filter((el) => getComputedStyle(el).backgroundImage.includes("rgb(246, 169, 42)") && !(el as HTMLButtonElement).disabled)
      .map((el) => (el.textContent ?? "").trim())
  );

for (const tema of ["light", "dark"] as const) {
  test(`${tema}: Favoritos con el cielo, la vuelta al perfil y cada persona en su tarjeta suave`, async ({ page }) => {
    await abrir(page, "/favorites", { tema });
    await expect(cielo(page).getByRole("heading", { level: 1 })).toHaveText("Trabajadores favoritos");
    await expect(cielo(page).getByRole("link", { name: "Volver al perfil" })).toHaveAttribute("href", "/profile");
    const tarjetas = hoja(page).locator(".tarjeta-suave");
    await expect(tarjetas).toHaveCount(2);
    await expect(tarjetas.first()).toContainText("Juana Pérez");
    await expect(tarjetas.first()).toContainText("Disponible");
    await expect(tarjetas.first()).toContainText("Mozo/a · 2 turnos juntos");
    // Ninguna acción lleva el ámbar: «Quitar» va quieto.
    expect(await ambares(page)).toEqual([]);
  });
}

for (const ancho of [390, 320]) {
  test(`Favoritos a ${ancho} px: con un nombre larguísimo, la tarjeta no se sale y «Quitar» queda entero`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 700 });
    await abrir(page, "/favorites");
    // Con las tarjetas ya dibujadas: sin esto los bucles de abajo no medían nada.
    await expect(hoja(page).locator(".tarjeta-suave")).toHaveCount(2);
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sobra).toBeLessThanOrEqual(0);
    for (const boton of await hoja(page).getByRole("button", { name: "Quitar" }).all()) {
      const caja = await boton.boundingBox();
      expect(caja!.x).toBeGreaterThanOrEqual(0);
      expect(caja!.x + caja!.width).toBeLessThanOrEqual(ancho);
    }
    for (const tarjeta of await hoja(page).locator(".tarjeta-suave").all()) {
      const caja = await tarjeta.boundingBox();
      expect(caja!.x + caja!.width).toBeLessThanOrEqual(ancho);
    }
  });
}

test("Favoritos en tablet (768 px): una columna, con lugar para el nombre y «Quitar»", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await abrir(page, "/favorites");
  // Esperar a que estén las tarjetas: medir antes daba una lista vacía (cortó CI).
  await expect(hoja(page).locator(".tarjeta-suave")).toHaveCount(2);
  const cajas = await hoja(page).locator(".tarjeta-suave").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().left));
  expect(new Set(cajas.map((x) => Math.round(x))).size).toBe(1);
  await expect(hoja(page).locator(".tarjeta-suave").first().getByRole("link", { name: "Juana Pérez" })).toBeVisible();
});

test("un ticket con un asunto larguísimo y sin espacios no corre la página", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await abrir(page, "/support/t1");
  await page.route("**/api/v1/support/tickets/t1", (r) => r.fulfill(json({ ...DETALLE, subject: "Nopuedosubirmicvdesdeelcelularyyaprobétresveces".repeat(3) })));
  await page.reload();
  await expect(cielo(page).getByRole("heading", { level: 1 })).toContainText("Nopuedosubir");
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sobra).toBeLessThanOrEqual(0);
});

// Que «Reportar un problema» (`/support?categoria=…&turno=…`) abra solo el ticket nuevo
// lo prueba `support.spec.ts`, que sigue pasando con la piel nueva.

test("Favoritos vacío: el estado vacío de siempre, sobre la hoja", async ({ page }) => {
  await abrir(page, "/favorites", { favoritos: [] });
  await expect(hoja(page).getByText("Tu gente de confianza va acá")).toBeVisible();
});

test("Soporte: la vuelta lleva a Ajustes, y con tickets el único ámbar es «Nuevo»", async ({ page }) => {
  await abrir(page, "/support");
  await expect(cielo(page).getByRole("heading", { level: 1 })).toHaveText("Soporte");
  await expect(cielo(page).getByRole("link", { name: "Volver a Ajustes" })).toHaveAttribute("href", "/profile/settings");
  await expect(hoja(page).getByRole("link", { name: /No puedo subir mi CV/ })).toHaveAttribute("href", "/support/t1");
  expect(await ambares(page)).toEqual(["Nuevo"]);
});

test("Soporte vacío: un solo ámbar, «Abrir un ticket», sin «Nuevo»", async ({ page }) => {
  await abrir(page, "/support", { tickets: [] });
  await expect(hoja(page).getByText("Todavía no abriste ningún ticket")).toBeVisible();
  await expect(page.getByRole("button", { name: "Nuevo" })).toHaveCount(0);
  expect(await ambares(page)).toEqual(["Abrir un ticket"]);
});

for (const tema of ["light", "dark"] as const) {
  test(`${tema}: el ticket lleva el asunto en el cielo, la conversación en la hoja y vuelve a Soporte`, async ({ page }) => {
    await abrir(page, "/support/t1", { tema });
    await expect(cielo(page).getByRole("heading", { level: 1 })).toHaveText("No puedo subir mi CV");
    await expect(cielo(page).getByRole("link", { name: "Volver a Soporte" })).toHaveAttribute("href", "/support");
    await expect(hoja(page)).toContainText("Abierto");
    await expect(hoja(page)).toContainText("No me deja subir el PDF.");
    await expect(hoja(page)).toContainText("Probá con una foto.");
    const respuesta = hoja(page).getByPlaceholder("Escribí tu respuesta...");
    await expect(respuesta).toBeVisible();
    // «Enviar» recién se prende con texto, y ahí es el único ámbar.
    expect(await ambares(page)).toEqual([]);
    await respuesta.fill("Gracias, pruebo con la foto.");
    expect(await ambares(page)).toEqual(["Enviar"]);
  });
}

test("el admin entra al mismo ticket y su vuelta lleva a la lista de Administración", async ({ page }) => {
  await abrir(page, "/support/t1", { rol: "admin" });
  await expect(cielo(page).getByRole("link", { name: "Volver a los tickets" })).toHaveAttribute("href", "/admin/support");
});

// Escritorio, renglón 8 (2026-11-24): en la compu Favoritos es una grilla de
// dos columnas dentro del marco; en el celular, una columna.
test("Favoritos en la compu (1440 px): grilla de dos columnas con «Quitar» a la vista", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page, "/favorites", {
    favoritos: [fav("w1", "Juana Pérez"), fav("w2", "Lucía Gómez"), fav("w3", "Tomás Rivero")],
  });
  const tarjetas = page.locator(".hoja .tarjeta-suave");
  await expect(tarjetas).toHaveCount(3);
  const c = await Promise.all([0, 1, 2].map(async (i) => (await tarjetas.nth(i).boundingBox())!));
  expect(Math.abs(c[0].y - c[1].y)).toBeLessThan(2);
  expect(c[1].x).toBeGreaterThan(c[0].x + c[0].width - 1);
  expect(c[2].y).toBeGreaterThan(c[0].y + c[0].height - 1);
  expect(c[0].width).toBeGreaterThan(380);
  const hoja = (await page.locator(".hoja").boundingBox())!;
  expect(hoja.width).toBeLessThanOrEqual(1024);
  expect(c[1].x + c[1].width).toBeLessThanOrEqual(hoja.x + hoja.width);
  for (const q of await page.getByRole("button", { name: "Quitar" }).all()) await expect(q).toBeInViewport();
});

// Escritorio, renglón 17 (2026-11-24): el ticket ya mide el ancho de lectura;
// se mide que las burbujas no pasen de ~560 px y que el campo no se estire.
test("en la compu (1440) el ticket queda en ancho de lectura, con burbujas de hasta 560 px", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page, "/support/t1");
  await expect(page.getByText("Probá con una foto.")).toBeVisible();
  const hoja = (await page.locator(".hoja").boundingBox())!;
  expect(hoja.width).toBeLessThanOrEqual(672);
  for (const burbuja of await page.locator(".burbuja").all()) {
    expect((await burbuja.boundingBox())!.width).toBeLessThanOrEqual(560);
  }
  const campo = (await page.getByPlaceholder("Escribí tu respuesta...").boundingBox())!;
  expect(campo.width).toBeLessThanOrEqual(640);
});
