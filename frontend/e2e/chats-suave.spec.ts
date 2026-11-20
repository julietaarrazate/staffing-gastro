import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

/**
 * Chats con la dirección suave (2026-11-20, ADR-0028,
 * docs/historial/2026-11-20-chats-direccion-suave.md): un cielo corto y liso
 * con el título en letra normal, la hoja con la lista (cada chat cuelga de su
 * turno) y la conversación con la misma piel: burbujas sin borde, el campo con
 * relleno y «Enviar» como el único ámbar.
 */
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const WORKER = { id: "user-1", email: "w@oido.test", full_name: "Camila", role: "worker", status: "activo", is_active: true, is_verified: true };
const haceMin = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const CHATS = [
  { shift_id: "s1", shift_title: "bartender", other_party_name: "Bar Mirasol", other_party_photo: null, last_message: "Dale, te esperamos 19:45 para el armado.", last_message_at: haceMin(0), unread_count: 2 },
  { shift_id: "s2", shift_title: "Moza/o para el evento de fin de año de la empresa de al lado", other_party_name: "La Vermutería del Pasaje", other_party_photo: null, last_message: "¿Hay que llevar delantal?", last_message_at: haceMin(60 * 24 * 20), unread_count: 0 },
];
const MENSAJES = [
  { id: "m1", shift_id: "s1", sender_user_id: "user-2", body: "Hola Camila, ¿venís?", created_at: haceMin(30), read: true },
  { id: "m2", shift_id: "s1", sender_user_id: "user-1", body: "Sí, llego 19:45.", created_at: haceMin(20), read: true },
];
const AMBAR = /rgb\(246, 169, 42\)|rgb\(229, 142, 15\)|rgb\(245, 158, 11\)|rgb\(217, 119, 6\)|rgb\(255, 171, 37\)/;

async function chats(page: Page, lista: unknown[] = CHATS) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json(WORKER)));
  await page.route("**/api/v1/chats", (r) => r.fulfill(json(lista)));
  await page.route("**/api/v1/chats/s1/messages", (r) => r.fulfill(json(MENSAJES)));
}

test("la lista: cielo corto con «Chats», y cada chat con su turno colgando", async ({ page }) => {
  await chats(page);
  await page.goto("/chats");
  const titulo = page.getByRole("heading", { level: 1, name: "Chats" });
  await expect(titulo).toBeVisible();
  await expect(titulo).toHaveClass(/titulo-pantalla/);
  // El cielo es corto: no llega a un quinto de la pantalla del celular.
  const cielo = await page.locator(".app-cielo").first().boundingBox();
  expect(cielo!.height).toBeLessThan(844 / 5);

  const mirasol = page.getByRole("link", { name: /Bar Mirasol/ });
  await expect(mirasol).toHaveAttribute("href", "/chats/s1");
  await expect(mirasol.locator(".chip-suave")).toHaveText("Bartender");
  await expect(mirasol).toContainText("Dale, te esperamos 19:45 para el armado.");
  // Sin leer: el contador, en azul hondo (no en ámbar).
  const sinLeer = mirasol.locator(".chat-sin-leer");
  await expect(sinLeer).toHaveText("2");
  expect(await sinLeer.evaluate((el) => getComputedStyle(el).backgroundImage)).not.toMatch(AMBAR);
  expect(await sinLeer.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toMatch(AMBAR);
  // El de hoy muestra la hora; el viejo, el día y el mes.
  await expect(mirasol).toContainText(/\d{2}:\d{2}/);
  const vermu = page.getByRole("link", { name: /La Vermutería/ });
  await expect(vermu.locator(".chat-sin-leer")).toHaveCount(0);
  await expect(vermu).toContainText(/\d{1,2} [a-z]{3}/);

  // Un título de turno largo no ensancha la pantalla: el chip se corta.
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(ancho).toBeLessThanOrEqual(0);
  const chip = await vermu.locator(".chip-suave").boundingBox();
  expect(chip!.x + chip!.width).toBeLessThanOrEqual(390);
});

test("la conversación en el celular: su cielo con la vuelta, burbujas sin borde y «Enviar» como único ámbar", async ({ page }) => {
  await chats(page);
  await page.goto("/chats/s1");
  await expect(page.getByText("Sí, llego 19:45.")).toBeVisible();
  // El cielo de la lista se guarda y queda el de la conversación.
  await expect(page.getByRole("heading", { level: 1, name: "Chats" })).toBeHidden();
  const volver = page.getByRole("link", { name: "Volver a mensajes" });
  await expect(volver).toBeVisible();
  await expect(volver).toHaveAttribute("href", "/chats");
  const toque = await volver.boundingBox();
  expect(Math.min(toque!.width, toque!.height)).toBeGreaterThanOrEqual(44);
  await expect(page.locator(".cielo-celular")).toContainText("Bar Mirasol");
  await expect(page.locator(".cielo-celular")).toContainText("Bartender");

  // Las burbujas: sin borde y sin ámbar, y la propia distinta de la ajena.
  const mia = page.locator(".burbuja-mia");
  const ajena = page.locator(".burbuja-ajena");
  await expect(mia).toHaveCount(1);
  await expect(ajena).toHaveCount(1);
  const fondo = (el: Element) => getComputedStyle(el).backgroundColor;
  expect(await mia.evaluate(fondo)).not.toMatch(AMBAR);
  expect(await mia.evaluate(fondo)).not.toBe(await ajena.evaluate(fondo));
  expect(await ajena.evaluate((el) => getComputedStyle(el).boxShadow)).toBe("none");

  // El campo de escribir es un `.campo` y «Enviar», el único ámbar.
  const campo = page.getByPlaceholder("Escribí un mensaje...");
  await expect(campo).toHaveClass(/campo/);
  const enviar = page.getByRole("button", { name: "Enviar" });
  await expect(enviar).toBeDisabled();
  await campo.fill("Hola");
  await expect(enviar).toBeEnabled();
  expect(await enviar.evaluate((el) => getComputedStyle(el).backgroundImage)).toMatch(AMBAR);
  const ambares = await page.evaluate((patron) => {
    const re = new RegExp(patron);
    return [...document.querySelectorAll<HTMLElement>("main *, body *")].filter((el) => {
      if (!el.offsetParent) return false;
      const s = getComputedStyle(el);
      return re.test(s.backgroundImage) || re.test(s.backgroundColor);
    }).length;
  }, AMBAR.source);
  expect(ambares).toBe(1);
});

test("mandar un mensaje: sale el pedido y el campo se vacía", async ({ page }) => {
  await chats(page);
  const enviados: string[] = [];
  await page.route("**/api/v1/chats/s1/messages", (r) => {
    if (r.request().method() === "POST") {
      enviados.push(r.request().postDataJSON().body);
      return r.fulfill({ ...json({ id: "m3", shift_id: "s1", sender_user_id: "user-1", body: "Voy", created_at: haceMin(0), read: false }), status: 201 });
    }
    return r.fulfill(json(MENSAJES));
  });
  await page.goto("/chats/s1");
  const campo = page.getByPlaceholder("Escribí un mensaje...");
  await campo.fill("Voy");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(campo).toHaveValue("");
  expect(enviados).toEqual(["Voy"]);
});

test("en la compu la lista y la conversación van lado a lado, sobre la misma hoja", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await chats(page);
  await page.goto("/chats/s1");
  await expect(page.getByText("Sí, llego 19:45.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Chats" })).toBeVisible();
  const abierta = page.getByRole("link", { name: /Bar Mirasol/ });
  await expect(abierta).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Volver a mensajes" })).toBeHidden();

  const lista = await abierta.boundingBox();
  const campo = await page.getByPlaceholder("Escribí un mensaje...").boundingBox();
  expect(campo!.x).toBeGreaterThan(lista!.x + lista!.width - 1);
  // El encabezado de la conversación va sobre la hoja, no sobre un cielo.
  expect(await page.locator(".cielo-celular").evaluate((el) => getComputedStyle(el).backgroundImage)).toBe("none");
  // Nada se sale de la ventana: se desplazan la lista y los mensajes, no la página.
  const alto = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  expect(alto).toBeLessThanOrEqual(0);
});

for (const tema of ["light", "dark"] as const) {
  test(`se lee en ${tema}: la hora de la burbuja propia`, async ({ page }) => {
    await setTheme(page, tema);
    await chats(page);
    await page.goto("/chats/s1");
    await expect(page.getByText("Sí, llego 19:45.")).toBeVisible();
    const contraste = await page.locator(".burbuja-mia .burbuja-meta").evaluate((el) => {
      const lum = (c: string) => {
        const [r, g, b] = c.match(/[\d.]+/g)!.slice(0, 3).map((n) => {
          const v = Number(n) / 255;
          return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const a = lum(getComputedStyle(el).color);
      const b = lum(getComputedStyle(el.closest(".burbuja")!).backgroundColor);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
    expect(contraste).toBeGreaterThanOrEqual(4.5);
  });
}
