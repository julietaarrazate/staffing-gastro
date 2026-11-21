import { test, expect, type Page } from "@playwright/test";
import { deContrato, fulfillContrato } from "./contrato";
import { blockExternalHosts, injectSession, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

/**
 * La tira de días de Mis turnos se toca (docs/historial/2026-11-21-mis-turnos-tira-tocable.md):
 * elegir un día muestra sólo ese día, las flechas cambian de semana, y lo que
 * viene después va en «Más adelante». Reloj fijo: jueves 19/11/2026, 18:30 en
 * Argentina (la semana del 16 al 22). Todas las fechas son absolutas, así que
 * el spec no depende del día en que corra.
 */
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const AHORA = new Date("2026-11-19T18:30:00-03:00");
const a = (dia: string, hora = "21:00") => `${dia}T${hora}:00-03:00`;
const fin = (dia: string) => a(dia, "23:30");

const turno = (o: Record<string, unknown>) => deContrato("turnos_asignados_trabajador", [{ company_name: "Bar Lavalle", ...o }])[0];
const asig = (id: string, dia: string, o: Record<string, unknown> = {}) =>
  turno({ id, position: "mozo", status: "confirmado", start_at: a(dia), end_at: fin(dia), ...o });

const TURNOS = () => [
  asig("hoy", "2026-11-19", { position: "bartender", start_at: a("2026-11-19", "19:30") }),
  asig("mie1", "2026-11-18", { start_at: a("2026-11-18", "12:00"), end_at: a("2026-11-18", "16:00"), status: "pagado" }),
  asig("mie2", "2026-11-18", { position: "cocinero" }),
  asig("sab", "2026-11-21"),
  // La semana anterior (sólo se llega con «‹»).
  asig("ant", "2026-11-13", { status: "pagado" }),
  // Semanas que vienen: 23/11 (2), 25/11, 27/11, 4/12 y 18/12.
  asig("f1", "2026-11-23"),
  asig("f2", "2026-11-23", { position: "barista" }),
  asig("f3", "2026-11-25"),
  asig("f4", "2026-11-27"),
  asig("f5", "2026-12-04"),
  asig("f6", "2026-12-18"),
];
const visibles = (page: Page) => page.locator("[data-shift-id]");
const ids = async (page: Page) => (await visibles(page).evaluateAll((els) => els.map((e) => e.getAttribute("data-shift-id")))).sort();
const dia = (page: Page, nombre: RegExp | string) => page.getByRole("button", { name: nombre });

async function abrir(page: Page, turnos: unknown[] = TURNOS(), extra?: (page: Page) => Promise<void>, url = "/my-shifts") {
  await page.clock.setFixedTime(AHORA);
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  // Catch-all primero: Playwright resuelve la última ruta registrada.
  await page.route("**/api/v1/**", (r) => (r.request().method() === "GET" ? r.fulfill(json([])) : r.continue()));
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => fulfillContrato(r, "auth_me_worker"));
  await page.route("**/api/v1/shifts/mine**", (r) => r.fulfill(json(turnos)));
  if (extra) await extra(page);
  await page.goto(url);
  await expect(page.getByTestId("semana-tira")).toBeVisible();
}

test("la semana entera: lo de lunes a domingo, hoy con su aro y sin nada elegido", async ({ page }) => {
  await abrir(page);
  await expect(page.getByText("Esta semana · 16 – 22 nov")).toBeVisible();
  expect(await ids(page)).toEqual(["hoy", "mie1", "mie2", "sab"]);
  await expect(page.locator('[data-shift-id="hoy"]')).toHaveAttribute("data-turno", "destacado");
  // Nada elegido: ningún día apretado y hoy con el aro, sin la tecla blanca.
  await expect(page.locator('[data-dia] button[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator('[data-dia="2026-11-19"] .dia-cielo-aro')).toHaveCount(1);
  await expect(page.locator(".dia-cielo-hoy")).toHaveCount(0);
  // Siete botones de 44 px o más, con su nombre completo.
  const botones = page.getByRole("list", { name: "Días de la semana" }).getByRole("button");
  await expect(botones).toHaveCount(7);
  for (const b of await botones.all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(dia(page, "miércoles 18, 2 turnos")).toBeVisible();
  await expect(dia(page, "jueves 19, hoy, 1 turno")).toBeVisible();
  await expect(dia(page, "martes 17")).toBeVisible();
  // Puntito sólo donde hay turnos (mié, jue y sáb).
  const conPunto = await page.locator("[data-dia]").evaluateAll((els) => els.filter((e) => e.querySelector("[data-con-turno]")).map((e) => e.getAttribute("data-dia")));
  expect(conPunto).toEqual(["2026-11-18", "2026-11-19", "2026-11-21"]);
  // Las pestañas siguen contando todo (11 asignados), con o sin filtro.
  await expect(page.locator("[data-pestanas]").getByRole("button", { name: /^Asignados/ })).toContainText("11");
});

test("tocar un día muestra sólo sus turnos; tocarlo de nuevo vuelve a la semana entera", async ({ page }) => {
  await abrir(page);
  await dia(page, "miércoles 18, 2 turnos").click();
  await expect(dia(page, "miércoles 18, 2 turnos")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-dia="2026-11-18"] .dia-cielo-hoy')).toHaveCount(1);
  // Hoy sin elegir lleva el aro; elegido otro día, sigue con el aro.
  await expect(page.locator('[data-dia="2026-11-19"] .dia-cielo-aro')).toHaveCount(1);
  expect(await ids(page)).toEqual(["mie1", "mie2"]);
  // La tarjeta destacada es de hoy: con otro día elegido no está.
  await expect(page.locator('[data-turno="destacado"]')).toHaveCount(0);
  await expect(page.locator("button.boton-relieve:not(:disabled)")).toHaveCount(0);
  // Elegir otro cambia el elegido (uno solo a la vez).
  await dia(page, "jueves 19, hoy, 1 turno").click();
  await expect(page.locator('[data-dia] button[aria-pressed="true"]')).toHaveCount(1);
  expect(await ids(page)).toEqual(["hoy"]);
  await expect(page.locator('[data-shift-id="hoy"]')).toHaveAttribute("data-turno", "destacado");
  // Tocar el elegido lo suelta.
  await dia(page, "jueves 19, hoy, 1 turno").click();
  await expect(page.locator('[data-dia] button[aria-pressed="true"]')).toHaveCount(0);
  expect(await ids(page)).toEqual(["hoy", "mie1", "mie2", "sab"]);
});

test("un día sin turnos es una línea tranquila, no un estado vacío grande", async ({ page }) => {
  await abrir(page);
  await dia(page, "martes 17").click();
  await expect(page.getByTestId("dia-vacio")).toHaveText("Nada el martes 17");
  await expect(visibles(page)).toHaveCount(0);
  await expect(page.getByText("Todavía no tenés turnos asignados")).toHaveCount(0);
  // «Más adelante» sigue ahí, y volver a tocar el día trae la semana.
  await expect(page.getByTestId("mas-adelante")).toBeVisible();
  await dia(page, "martes 17").click();
  await expect(page.getByTestId("dia-vacio")).toHaveCount(0);
  expect(await ids(page)).toEqual(["hoy", "mie1", "mie2", "sab"]);
});

test("las flechas cambian de semana, suelta el día elegido y «Volver a esta semana» regresa", async ({ page }) => {
  await abrir(page);
  // Hay turnos antes y después: las dos flechas llevan puntito.
  await expect(page.getByRole("button", { name: "Semana anterior, con turnos" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Semana siguiente, con turnos" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Volver a esta semana" })).toHaveCount(0);

  await dia(page, "miércoles 18, 2 turnos").click();
  await page.getByRole("button", { name: /^Semana siguiente/ }).click();
  await expect(page.getByText("Semana · 23 – 29 nov")).toBeVisible();
  await expect(page.locator('[data-dia] button[aria-pressed="true"]')).toHaveCount(0);
  expect(await ids(page)).toEqual(["f1", "f2", "f3", "f4"]);
  // Sin hoy en pantalla: ni aro, ni tarjeta destacada.
  await expect(page.locator(".dia-cielo-aro")).toHaveCount(0);
  await expect(page.locator('[data-turno="destacado"]')).toHaveCount(0);
  // «Más adelante» ya sólo lista lo posterior a esa semana.
  await expect(page.getByTestId("mas-adelante").getByRole("listitem")).toHaveCount(2);
  await expect(page.getByTestId("mas-adelante")).not.toContainText("23 nov");

  await page.getByRole("button", { name: "Volver a esta semana" }).click();
  await expect(page.getByText("Esta semana · 16 – 22 nov")).toBeVisible();
  expect(await ids(page)).toEqual(["hoy", "mie1", "mie2", "sab"]);
  await expect(page.locator('[data-shift-id="hoy"]')).toHaveAttribute("data-turno", "destacado");

  // Hacia atrás: la semana pasada se llega con «‹» y no se lista en ningún otro lado.
  await expect(page.getByTestId("mas-adelante")).not.toContainText("13 nov");
  await page.getByRole("button", { name: /^Semana anterior/ }).click();
  await expect(page.getByText("Semana · 9 – 15 nov")).toBeVisible();
  expect(await ids(page)).toEqual(["ant"]);
  await expect(page.getByRole("button", { name: "Semana anterior" })).toBeVisible(); // ya no hay más: sin puntito
  await expect(page.getByRole("button", { name: "Semana siguiente, con turnos" })).toBeVisible();
});

test("«Más adelante»: tres filas, «Ver los N que siguen», y tocar una salta a su semana con ese día", async ({ page }) => {
  await abrir(page);
  const mas = page.getByTestId("mas-adelante");
  await expect(mas.getByRole("heading", { name: /Más adelante/ })).toContainText("6");
  await expect(mas.getByRole("listitem")).toHaveCount(3);
  await expect(mas.getByRole("listitem").first()).toContainText("lun 23 nov");
  await expect(mas.getByRole("listitem").first()).toContainText("Mozo");
  await expect(mas.getByRole("listitem").first()).toContainText("Confirmado");
  await mas.getByRole("button", { name: "Ver los 3 que siguen" }).click();
  await expect(mas.getByRole("listitem")).toHaveCount(6);
  await expect(mas.getByRole("button", { name: /^Ver los/ })).toHaveCount(0);

  await mas.getByRole("button", { name: /vie 27 nov/ }).click();
  await expect(page.getByText("Semana · 23 – 29 nov")).toBeVisible();
  await expect(dia(page, /^viernes 27, 1 turno/)).toHaveAttribute("aria-pressed", "true");
  expect(await ids(page)).toEqual(["f4"]);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  // Y de otra semana lejana: 18/12 es tres semanas después de la del 23.
  await page.getByTestId("mas-adelante").getByRole("button", { name: /vie 18 dic/ }).click();
  await expect(page.getByText("Semana · 14 – 20 dic")).toBeVisible();
  expect(await ids(page)).toEqual(["f6"]);
  await expect(page.getByTestId("mas-adelante")).toHaveCount(0);
});

test("teclado: Tab llega a las flechas y a cada día, Enter y Espacio los accionan", async ({ page }) => {
  await abrir(page);
  const miercoles = dia(page, "miércoles 18, 2 turnos");
  await miercoles.focus();
  await page.keyboard.press("Enter");
  await expect(miercoles).toHaveAttribute("aria-pressed", "true");
  expect(await ids(page)).toEqual(["mie1", "mie2"]);
  await page.keyboard.press("Space");
  await expect(miercoles).toHaveAttribute("aria-pressed", "false");
  // Tab pasa al día que sigue (los botones son parte del orden normal).
  await page.keyboard.press("Tab");
  await expect(dia(page, "jueves 19, hoy, 1 turno")).toBeFocused();
  await page.keyboard.press("Space");
  await expect(dia(page, "jueves 19, hoy, 1 turno")).toHaveAttribute("aria-pressed", "true");
  // Las flechas de semana, con el teclado: Enter para adelante, Espacio para atrás.
  await page.getByRole("button", { name: /^Semana siguiente/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Semana · 23 – 29 nov")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Semana anterior/ })).toBeVisible();
  await page.getByRole("button", { name: /^Semana anterior/ }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByText("Esta semana · 16 – 22 nov")).toBeVisible();
  // El foco se ve: el contorno de `focus-visible` existe.
  await miercoles.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  expect(await miercoles.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("solid");
});

test("el filtro vale para las tres pestañas y los contadores siguen contando todo", async ({ page }) => {
  const shift = (id: string, dia: string) => ({ ...deContrato("postulaciones_mias")[0].shift, id, start_at: a(dia), end_at: fin(dia), status: "publicado" });
  const posts = [
    { id: "ap1", shift_id: "p1", status: "pendiente", shift: shift("p1", "2026-11-20") },
    { id: "ap2", shift_id: "p2", status: "pendiente", shift: shift("p2", "2026-11-24") },
  ].map((x) => ({ ...deContrato("postulaciones_mias")[0], ...x }));
  const guardados = [shift("g1", "2026-11-20"), shift("g2", "2026-11-22"), shift("g3", "2026-12-01")];
  await abrir(page, TURNOS(), async (p) => {
    await p.route("**/api/v1/applications/mine**", (r) => r.fulfill(json(posts)));
    await p.route("**/api/v1/saved-shifts", (r) => (r.request().method() === "GET" ? r.fulfill(json(guardados)) : r.continue()));
  });
  const pestanas = page.locator("[data-pestanas]");
  await pestanas.getByRole("button", { name: /^Postulaciones/ }).click();
  // Postulaciones: p1 (vie 20) está en la semana; p2 (mar 24) va a «Más adelante».
  expect(await ids(page)).toEqual(["p1"]);
  await expect(page.getByTestId("mas-adelante")).toContainText("mar 24 nov");
  await expect(page.getByTestId("mas-adelante").getByRole("listitem")).toHaveCount(1);
  await expect(dia(page, "viernes 20, 1 turno")).toBeVisible();
  await expect(dia(page, "jueves 19, hoy")).toBeVisible(); // sin turno en esta pestaña: sin conteo
  await expect(pestanas.getByRole("button", { name: /^Postulaciones/ })).toContainText("2");
  await dia(page, "sábado 21").click();
  await expect(page.getByTestId("dia-vacio")).toHaveText("Nada el sábado 21");
  await expect(pestanas.getByRole("button", { name: /^Postulaciones/ })).toContainText("2");
  // Guardados: g1 (vie 20) y g2 (dom 22) en la semana, g3 (1 dic) más adelante. El día sigue elegido.
  await pestanas.getByRole("button", { name: /^Guardados/ }).click();
  await expect(dia(page, "sábado 21")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("dia-vacio")).toHaveText("Nada el sábado 21");
  await dia(page, "sábado 21").click();
  expect(await ids(page)).toEqual(["g1", "g2"]);
  await expect(page.getByTestId("mas-adelante")).toContainText("mar 1 dic");
  await expect(pestanas.getByRole("button", { name: /^Guardados/ })).toContainText("3");
  // Asignados: la semana de los 11 turnos sigue igual.
  await pestanas.getByRole("button", { name: /^Asignados/ }).click();
  expect(await ids(page)).toEqual(["hoy", "mie1", "mie2", "sab"]);
});

test("un aviso a un turno de otra semana abre esa semana, no una lista sin la tarjeta", async ({ page }) => {
  await abrir(page, TURNOS(), undefined, "/my-shifts?turno=f4");
  await expect(page.getByText("Semana · 23 – 29 nov")).toBeVisible();
  await expect(page.locator('[data-shift-id="f4"]')).toBeVisible();
  await expect(page.locator("#turno-f4")).toHaveClass(/ring-primary-text/);
  // Y la tira quedó en esa semana, sin día elegido.
  await expect(page.locator('[data-dia] button[aria-pressed="true"]')).toHaveCount(0);
});

test("sin turnos la pantalla sigue siendo la de siempre: estado vacío y la tira quieta, sin «Más adelante»", async ({ page }) => {
  await abrir(page, []);
  await expect(page.getByText("Todavía no tenés turnos asignados")).toBeVisible();
  await expect(page.getByTestId("mas-adelante")).toHaveCount(0);
  await expect(page.getByTestId("dia-vacio")).toHaveCount(0);
  await expect(page.locator("[data-con-turno]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Semana anterior" })).toBeVisible();
});

for (const theme of ["light", "dark"] as const) {
  for (const ancho of [320, 390]) {
    test(`${theme} a ${ancho} px: la semana, un día elegido y «Más adelante» desplegado no corren la página`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: 800 });
      await setTheme(page, theme);
      await abrir(page);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const sinScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      expect(await sinScroll()).toBe(true);
      await dia(page, "miércoles 18, 2 turnos").click();
      expect(await sinScroll()).toBe(true);
      await dia(page, "martes 17").click();
      expect(await sinScroll()).toBe(true);
      await page.getByRole("button", { name: /^Ver los/ }).click();
      expect(await sinScroll()).toBe(true);
      await page.getByRole("button", { name: /^Semana siguiente/ }).click();
      expect(await sinScroll()).toBe(true);
      // Nada de la tira ni de las filas se sale del ancho de la pantalla.
      const salidos = await page.evaluate(() =>
        [...document.querySelectorAll('[data-testid="semana-tira"] *, [data-testid="mas-adelante"] *')]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && (r.left < -0.5 || r.right > window.innerWidth + 0.5);
          })
          .map((el) => el.className),
      );
      expect(salidos).toEqual([]);
      // La letra del día elegido contra la tecla blanca se lee (más de 4,5).
      await page.getByRole("button", { name: "Volver a esta semana" }).click();
      await dia(page, "miércoles 18, 2 turnos").click();
      const contraste = await page.evaluate(() => {
        const canal = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        const luz = (c: string) => {
          const [r, g, b] = c.match(/[\d.]+/g)!.map(Number);
          return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
        };
        const el = document.querySelector<HTMLElement>(".dia-cielo-hoy")!;
        const e = getComputedStyle(el);
        const [x, y] = [luz(e.color), luz(e.backgroundColor)].sort((p, q) => q - p);
        return (x + 0.05) / (y + 0.05);
      });
      expect(contraste).toBeGreaterThan(4.5);
    });
  }
}

test("con la letra al 200 % y movimiento reducido la tira y las filas se leen y no se salen", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.fontSize = "32px";
    });
  });
  await abrir(page);
  await page.getByRole("button", { name: /^Semana siguiente/ }).click();
  const mas = page.getByTestId("mas-adelante");
  await expect(mas).toBeVisible();
  // Con la letra grande las tarjetas de turno (`TurnoSuave`) ya se salen por su cuenta: acá
  // se mide lo de esta función, la tira y «Más adelante» (abierto en la semana de hoy).
  await page.getByRole("button", { name: /^Volver a esta semana/ }).click();
  const salidos = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="semana-tira"], [data-testid="semana-tira"] *, [data-testid="mas-adelante"], [data-testid="mas-adelante"] *')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.left < -0.5 || r.right > window.innerWidth + 0.5);
      })
      .map((el) => el.className),
  );
  expect(salidos).toEqual([]);
  // Con movimiento reducido el botón no se achica al apretarlo.
  // (la regla global de movimiento reducido la deja en 0,01 ms).
  const duracion = await dia(page, /^lunes 16/).evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration));
  expect(duracion).toBeLessThan(0.001);
  // Los siete nombres de día no se pisan entre sí.
  const cajas = await page.locator(".dia-nombre").evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => [r.left, r.right]));
  for (let i = 1; i < cajas.length; i++) expect(cajas[i][0]).toBeGreaterThanOrEqual(cajas[i - 1][1] - 0.5);
});

test("en la compu (1280) la tira y «Más adelante» no se estiran por toda la pantalla", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await abrir(page);
  const tira = await page.getByTestId("semana-tira").boundingBox();
  expect(tira!.width).toBeLessThanOrEqual(448 + 1);
  const mas = await page.getByTestId("mas-adelante").locator("ul").boundingBox();
  expect(mas!.width).toBeLessThanOrEqual(576 + 1);
});
