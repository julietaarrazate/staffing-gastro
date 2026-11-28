import { test, expect, type Page } from "@playwright/test";
import { deContrato, fulfillContrato } from "./contrato";
import { blockExternalHosts, enDias, injectSession, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

/**
 * Las hojas y ventanas compartidas con la dirección suave (ADR-0028,
 * 2026-11-21, docs/historial/2026-11-21-hojas-compartidas-suaves.md): `Sheet`,
 * `Modal`, «¡Turno publicado!», los avisos de la campanita. Sin relieve (ni
 * `boton-relieve` con sombra dura, ni filete, ni letra serif), la hoja blanca
 * con esquinas grandes, los botones suaves y UN solo ámbar por ventana (en una
 * confirmación destructiva, el de confirmar va en rojo y no hay ámbar). Qué abre
 * cada cosa, el foco, `Escape` y los textos son los de siempre. Se mide
 * renderizado, en claro y de noche.
 */
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const AMBAR = /rgb\(246, 169, 42\)/;
const RELIEVE_DURO = /\b[2-9]px [2-9]px 0px\b/;

/** Cuántos botones a la vista llevan el ámbar de la acción principal. */
const ambares = (page: Page) =>
  page
    .locator("[role=dialog] button:visible, [role=dialog] a:visible")
    .evaluateAll((els) => els.filter((el) => /rgb\(246, 169, 42\)/.test(getComputedStyle(el).backgroundImage)).length);

/** Los botones de la ventana que conservan la sombra dura del relieve. */
const conRelieve = (page: Page) =>
  page
    .locator("[role=dialog] button, [role=dialog] a")
    .evaluateAll((els) => els.filter((el) => /\b[2-9]px [2-9]px 0px\b/.test(getComputedStyle(el).boxShadow)).length);

async function panelDelComercio(page: Page, theme: "light" | "dark") {
  const [turno] = deContrato("turnos_del_comercio_con_asignado", [{ status: "confirmado", worker_name: "Trabajador Demo" }]);
  await page.clock.setFixedTime(new Date("2037-12-16T12:00:00-03:00"));
  await setTheme(page, theme);
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => fulfillContrato(r, "auth_me_employer", { full_name: "Comercio Demo" }));
  await page.route("**/api/v1/reviews/shifts/*", (r) => r.fulfill(json([])));
  await page.route("**/api/v1/shifts/me", (r) => r.fulfill(json([turno])));
  await page.route(/\/api\/v1\/shifts\/shift-1$/, (r) => r.fulfill(json({ ...turno, worker_name: null, company_name: "Bar Palermo" })));
  await page.goto("/shifts");
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

async function publicarUnTurno(page: Page, theme: "light" | "dark") {
  await setTheme(page, theme);
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => fulfillContrato(r, "auth_me_employer", { full_name: "Comercio Demo" }));
  await page.route("**/api/v1/shifts", (r) =>
    r.request().method() === "POST" ? r.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: "shift-new-1" }) }) : r.continue()
  );
  await page.route("**/api/v1/shifts/shift-new-1/publish", (r) => r.fulfill(json({})));
  await page.route("**/api/v1/shifts/me", (r) => r.fulfill(json([])));
  await page.goto("/shifts/new");
  await page.getByRole("button", { name: "Mozo/a" }).click();
  await page.locator('input[type="datetime-local"]').first().fill(enDias(30, "20:00"));
  await page.locator('input[type="datetime-local"]').nth(1).fill(enDias(30, "23:00"));
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByPlaceholder("48.000").fill("15000");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.locator("select").nth(1).selectOption("Palermo");
  await page.getByRole("button", { name: "Publicar turno" }).click();
}

async function sinDesborde(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

for (const theme of ["light", "dark"] as const) {
  for (const ancho of [320, 390, 1280]) {
    test.describe(`${theme} · ${ancho}`, () => {
      test.use({ viewport: { width: ancho, height: ancho === 1280 ? 800 : 700 } });

      test("«Más acciones» es una hoja suave: manija, título en la letra de la app, cruz de 44 px, filas redondas y sin rayas", async ({ page }) => {
        await panelDelComercio(page, theme);
        await page.getByRole("button", { name: "Más acciones" }).click();
        const hoja = page.getByRole("dialog", { name: "Más acciones" });
        await expect(hoja).toBeVisible();
        await expect(hoja).toHaveClass(/hoja-flotante/);
        await expect(hoja).toHaveCSS("border-top-left-radius", "28px");
        await expect(hoja).toHaveCSS("border-bottom-left-radius", "0px");
        await expect(hoja.locator(".manija-suave")).toBeVisible();
        // El título: la letra de la app (Inter), nunca la serif ni la brocha.
        const letra = await hoja.getByRole("heading", { name: "Más acciones" }).evaluate((el) => getComputedStyle(el).fontFamily);
        expect(letra).not.toMatch(/serif|young|shrikhand|brocha/i);
        const cruz = hoja.getByRole("button", { name: "Cerrar" });
        const caja = (await cruz.boundingBox())!;
        // Redondeado: la hoja entra con un transform y la caja mide 43,99997 px.
        expect(Math.round(Math.min(caja.width, caja.height))).toBeGreaterThanOrEqual(44);
        // Las filas: redondas, de 48 px o más y sin rayas entre una y otra.
        const filas = hoja.locator(".fila-hoja");
        expect(await filas.count()).toBeGreaterThan(1);
        for (const fila of await filas.all()) {
          await expect(fila).toHaveCSS("border-top-left-radius", "16px");
          // Redondeado: a 320 px el alto sale 47,99997 por el redondeo de subpíxeles.
          expect(Math.round(await fila.evaluate((el) => el.getBoundingClientRect().height))).toBeGreaterThanOrEqual(48);
        }
        await expect(hoja.locator(".divide-y")).toHaveCount(0);
        // El velo es de tinta, no negro puro.
        await expect(page.locator(".velo-suave")).not.toHaveCSS("background-color", /^rgba\(0, 0, 0/);
        await sinDesborde(page);
      });

      test("la confirmación destructiva: diálogo suave, «Volver» quieto, confirmar en rojo, ni relieve ni ámbar; el foco queda adentro y Escape cierra", async ({ page }) => {
        await panelDelComercio(page, theme);
        await page.getByRole("button", { name: "Más acciones" }).click();
        await page.getByRole("dialog", { name: "Más acciones" }).getByRole("button", { name: "Cancelar turno" }).click();
        const dialogo = page.getByRole("dialog", { name: "¿Cancelar este turno?" });
        await expect(dialogo).toBeVisible();
        await expect(dialogo).toHaveClass(/dialogo-suave/);
        await expect(dialogo).toHaveCSS("border-top-left-radius", "28px");
        await expect(dialogo).not.toHaveCSS("box-shadow", RELIEVE_DURO);
        const volver = dialogo.getByRole("button", { name: "Volver" });
        const confirmar = dialogo.getByRole("button", { name: "Sí, cancelar turno" });
        await expect(volver).toHaveClass(/boton-secundario/);
        await expect(volver).toHaveCSS("box-shadow", "none");
        await expect(volver).toHaveCSS("border-top-left-radius", "16px");
        await expect(confirmar).toHaveCSS("background-color", "rgb(194, 47, 47)");
        expect(await ambares(page)).toBe(0);
        expect(await conRelieve(page)).toBe(0);
        // Foco: Tab no sale del diálogo y el foco se ve.
        await page.keyboard.press("Tab");
        for (let i = 0; i < 4; i++) {
          expect(await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"))).toBe(true);
          await page.keyboard.press("Tab");
        }
        await confirmar.focus();
        expect(await confirmar.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
        await sinDesborde(page);
        await page.keyboard.press("Escape");
        await expect(dialogo).toHaveCount(0);
      });
    });
  }

  test.describe(`${theme} · celular`, () => {
    test("«¡Turno publicado!»: diálogo suave, el único ámbar es «Ver mi turno», el paso 1 en azul hondo y sin relieve", async ({ page }) => {
      await publicarUnTurno(page, theme);
      const dialogo = page.getByRole("dialog");
      await expect(dialogo.getByText("¡Turno publicado!")).toBeVisible();
      await expect(dialogo).toHaveClass(/dialogo-suave/);
      await expect(dialogo).toHaveCSS("border-top-left-radius", "28px");
      await expect(dialogo.getByRole("button", { name: "Ver mi turno" })).toHaveCSS("background-image", AMBAR);
      expect(await ambares(page)).toBe(1);
      expect(await conRelieve(page)).toBe(0);
      // Ni el círculo del paso 1 ni la etiqueta «ahora» son ámbar.
      await expect(dialogo.locator(".paso-chapa[data-actual=true]")).toHaveCSS("background-image", /rgb\(42, 115, 163\)/);
      await expect(dialogo.locator(".chip-suave-chico")).toHaveCSS("border-top-left-radius", /^\d{3,}|\d+px$/);
      await expect(dialogo.locator("span.bg-primary")).toHaveCount(0);
      await sinDesborde(page);
      // El foco entra al diálogo y Escape lo cierra.
      expect(await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"))).toBe(true);
      await page.keyboard.press("Escape");
      await expect(page.getByText("¡Turno publicado!")).toHaveCount(0);
    });

    test("con la letra al 200 % la ventana entra en la pantalla y se desplaza adentro, sin tapar sus botones", async ({ page }) => {
      await publicarUnTurno(page, theme);
      await expect(page.getByText("¡Turno publicado!")).toBeVisible();
      await page.addStyleTag({ content: "html { font-size: 32px !important; }" });
      const dialogo = page.getByRole("dialog");
      const caja = (await dialogo.boundingBox())!;
      expect(caja.y).toBeGreaterThanOrEqual(0);
      expect(caja.y + caja.height).toBeLessThanOrEqual(844);
      expect(await dialogo.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      await dialogo.getByRole("button", { name: "Cerrar" }).scrollIntoViewIfNeeded();
      await expect(dialogo.getByRole("button", { name: "Cerrar" })).toBeInViewport();
    });
  });
}

test.describe("avisos de la campanita", () => {
  async function conAvisos(page: Page, theme: "light" | "dark") {
    await setTheme(page, theme);
    await injectSession(page);
    await skipSplash(page);
    await blockExternalHosts(page);
    await page.route("**/api/v1/**", (r) => (r.request().method() === "GET" ? r.fulfill(json([])) : r.continue()));
    await page.route("**/api/v1/auth/me", (r) => fulfillContrato(r, "auth_me_worker"));
    await page.route("**/api/v1/notifications", (r) =>
      r.request().method() !== "GET"
        ? r.continue()
        : r.fulfill(json(deContrato("avisos_trabajador", [{ id: "notification-3" }, { id: "notification-4", read: true }])))
    );
    await page.goto("/feed");
  }

  for (const theme of ["light", "dark"] as const) {
    test(`${theme}: la lista va en una hoja suave con una tarjeta por aviso; el que no se leyó, con el relleno del campo y un punto`, async ({ page }) => {
      await conAvisos(page, theme);
      await page.getByRole("button", { name: "Avisos" }).click();
      const hoja = page.getByRole("dialog", { name: "Avisos" });
      await expect(hoja).toHaveClass(/hoja-flotante/);
      const avisos = hoja.locator(".aviso-fila");
      await expect(avisos).toHaveCount(2);
      for (const aviso of await avisos.all()) await expect(aviso).toHaveCSS("border-top-left-radius", "16px");
      await expect(hoja.locator('.aviso-fila[data-sin-leer="true"]')).toHaveCount(1);
      await expect(hoja.locator(".aviso-punto")).toHaveCount(1);
      // Sin rayas entre avisos ni el borde de color de antes.
      for (const aviso of await avisos.all()) await expect(aviso).toHaveCSS("border-bottom-width", "0px");
      const sinLeer = await hoja.locator('.aviso-fila[data-sin-leer="true"]').evaluate((el) => getComputedStyle(el).backgroundColor);
      const leido = await hoja.locator('.aviso-fila[data-sin-leer="false"]').evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(sinLeer).not.toBe(leido);
      await sinDesborde(page);
      await page.keyboard.press("Escape");
      await expect(hoja).toHaveCount(0);
    });
  }

  test("en la compu el desplegable de la barra también es suave", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await conAvisos(page, "light");
    await page.getByRole("button", { name: "Avisos" }).first().click();
    const panel = page.locator(".panel-avisos");
    await expect(panel).toBeVisible();
    await expect(panel).toHaveCSS("border-top-left-radius", "22px");
    await expect(panel.locator(".aviso-fila")).toHaveCount(2);
  });
});

test("con «reducir movimiento» la hoja aparece sin animar y queda en su lugar", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await panelDelComercio(page, "light");
  await page.getByRole("button", { name: "Más acciones" }).click();
  const hoja = page.getByRole("dialog", { name: "Más acciones" });
  await expect(hoja).toBeVisible();
  await expect(hoja).toHaveCSS("transform", /none|matrix\(1, 0, 0, 1, 0, 0\)/);
  await expect(hoja.getByRole("button", { name: "Cerrar" })).toHaveCSS("transition-duration", /^(0|1e-05)s$/);
});

test("el diálogo de confirmación va por encima de las hojas (z-index) y de la barra de abajo", async ({ page }) => {
  await panelDelComercio(page, "light");
  await page.getByRole("button", { name: "Más acciones" }).click();
  await page.getByRole("dialog", { name: "Más acciones" }).getByRole("button", { name: "Cancelar turno" }).click();
  const dialogo = page.getByRole("dialog", { name: "¿Cancelar este turno?" });
  await expect(dialogo).toBeVisible();
  // La capa del diálogo (z-60) pesa más que la de una hoja (z-50) y que la barra.
  expect(await dialogo.evaluate((el) => Number(getComputedStyle(el.parentElement!).zIndex))).toBeGreaterThanOrEqual(60);
  // Y lo que se ve en el centro del diálogo es el diálogo, no la barra de abajo.
  const caja = (await dialogo.boundingBox())!;
  expect(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest("[role=dialog]"), { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2 })).toBe(true);
});
