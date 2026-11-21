import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";
import { deContrato } from "./contrato";

/**
 * «Urgentes» del Inicio de quien trabaja: los turnos que empiezan en las
 * próximas 6 h, con cuenta regresiva (lib/urgentes.ts, worker/UrgentesRow).
 * El reloj está fijado: hoy es el sábado 21/11/2026 a las 12:00 en Argentina.
 */
const AHORA = new Date("2026-11-21T12:00:00-03:00");
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
/** Un turno que empieza `min` minutos después de AHORA. */
const en = (min: number) => new Date(AHORA.getTime() + min * 60_000).toISOString();
const fin = (min: number) => en(min + 240);

function turno(id: string, min: number, extra: Record<string, unknown> = {}) {
  return { id, start_at: en(min), end_at: fin(min), company_name: `Local ${id}`, position: "bartender", ...extra };
}

async function inicio(page: Page, turnos: Record<string, unknown>[], tema: "light" | "dark" = "light") {
  await page.clock.install({ time: AHORA });
  await setTheme(page, tema);
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json(deContrato("auth_me_worker", { full_name: "Sofía Demo" }))));
  await page.route("**/api/v1/shifts/feed**", (r) => r.fulfill(json(deContrato("feed", turnos))));
  await page.route("**/api/v1/applications/mine**", (r) => r.fulfill(json([])));
  await page.route("**/api/v1/workers/me/profile", (r) =>
    r.fulfill(json(deContrato("perfil_trabajador", { city: "Palermo, CABA", skills: ["mozo"] })))
  );
  await page.goto("/feed");
}

const region = (page: Page) => page.getByRole("region", { name: "Urgentes" });
const sinScrollDePagina = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

const TRES = () => [
  turno("tarde", 300, { pay_amount: "30000" }),
  turno("ya", 45, { pay_amount: "25000", urgent: true }),
  turno("medio", 100, { pay_amount: "28000" }),
  // Afuera: empieza dentro de 7 h y uno ya empezó hace 10 min.
  turno("lejos", 420),
  turno("empezado", -10),
];

test("con 3 urgentes: la fila va ordenada por quién empieza antes, con la cuenta regresiva, y los demás no entran", async ({ page }) => {
  await inicio(page, TRES());
  const urgentes = region(page);
  await expect(urgentes).toBeVisible();
  await expect(urgentes.getByRole("heading", { name: "Urgentes" })).toBeVisible();
  const tarjetas = urgentes.getByTestId("feed-urgente-card");
  await expect(tarjetas).toHaveCount(3);
  await expect(tarjetas.nth(0)).toHaveAttribute("href", "/turno/ya");
  await expect(tarjetas.nth(1)).toHaveAttribute("href", "/turno/medio");
  await expect(tarjetas.nth(2)).toHaveAttribute("href", "/turno/tarde");
  await expect(tarjetas.nth(0)).toContainText("Empieza en 45 min");
  await expect(tarjetas.nth(1)).toContainText("Empieza en 1 h 40");
  await expect(tarjetas.nth(2)).toContainText("Empieza en 5 h");
  await expect(tarjetas.nth(0)).toContainText("$25.000");
  await expect(tarjetas.nth(0)).toContainText("Local ya");
  await expect(tarjetas.nth(0)).toHaveAccessibleName(/^Urgente, Bartender, Local ya, empieza en 45 min, \$25\.000/);
  // Sin región en vivo: el cambio de minuto no se anuncia.
  expect(await urgentes.evaluate((el) => el.querySelectorAll("[aria-live], [role=status], [role=alert]").length)).toBe(0);
  // Siguen también en «Para vos» / «Cerca tuyo»: no se sacan de ahí.
  await expect(page.getByTestId("feed-hero-card")).toBeVisible();
  await expect(page.getByTestId("feed-nearby-card")).toHaveCount(4);
});

test("sin urgentes la sección no existe (ni título ni hueco)", async ({ page }) => {
  await inicio(page, [turno("lejos", 420), turno("empezado", -10), turno("manana", 24 * 60)]);
  await expect(page.getByTestId("feed-hero-card")).toBeVisible();
  await expect(page.getByTestId("feed-urgentes")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Urgentes" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Urgentes" })).toHaveCount(0);
});

test("pasa el tiempo: baja la cuenta, el turno que empieza sale de la fila y al final desaparece la sección", async ({ page }) => {
  await inicio(page, [turno("a", 2), turno("b", 100)]);
  const tarjetas = region(page).getByTestId("feed-urgente-card");
  await expect(tarjetas).toHaveCount(2);
  await expect(tarjetas.nth(0)).toContainText("Empieza en 2 min");
  await expect(tarjetas.nth(1)).toContainText("Empieza en 1 h 40");

  await page.clock.pauseAt(new Date(AHORA.getTime() + 5_000));
  await page.clock.runFor("01:00");
  await expect(tarjetas.nth(0)).toContainText("Empieza en 1 min");
  await expect(tarjetas.nth(1)).toContainText("Empieza en 1 h 39");

  await page.clock.runFor("01:00");
  await expect(tarjetas).toHaveCount(1);
  await expect(tarjetas.nth(0)).toHaveAttribute("href", "/turno/b");
  await expect(tarjetas.nth(0)).toContainText("Empieza en 1 h 38");

  await page.clock.runFor("01:40:00");
  await expect(page.getByTestId("feed-urgentes")).toHaveCount(0);
  await expect(page.getByTestId("feed-hero-card")).toBeVisible();
});

test("un turno que estaba a más de 6 h entra a la fila cuando se acerca", async ({ page }) => {
  await inicio(page, [turno("a", 6 * 60 + 2), turno("b", 600)]);
  await expect(page.getByTestId("feed-hero-card")).toBeVisible();
  await expect(page.getByTestId("feed-urgentes")).toHaveCount(0);
  await page.clock.pauseAt(new Date(AHORA.getTime() + 5_000));
  await page.clock.runFor("03:00");
  await expect(region(page).getByTestId("feed-urgente-card")).toHaveCount(1);
  await expect(region(page)).toContainText("Empieza en 5 h 59");
});

test("tocar una tarjeta lleva al turno", async ({ page }) => {
  await inicio(page, TRES());
  await page.route("**/api/v1/shifts/medio**", (r) => r.fulfill(json(deContrato("turno_publico", { id: "medio" }))));
  await region(page).getByTestId("feed-urgente-card").nth(1).click();
  await expect(page).toHaveURL(/\/turno\/medio$/);
});

test("se recorre con el teclado: cada tarjeta recibe el foco, con su anillo", async ({ page }) => {
  await inicio(page, TRES());
  const tarjetas = region(page).getByTestId("feed-urgente-card");
  await tarjetas.nth(0).focus();
  await page.keyboard.press("Tab");
  await expect(tarjetas.nth(1)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(tarjetas.nth(2)).toBeFocused();
  const anillo = await tarjetas.nth(2).evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(anillo).not.toBe("none");
});

for (const tema of ["light", "dark"] as const) {
  for (const ancho of [320, 390]) {
    test(`${tema} a ${ancho}: la página no scrollea de costado, el carril sí, y no hay ámbar en la sección`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: 844 });
      const ocho = Array.from({ length: 10 }, (_, i) =>
        turno(`t${i}`, 20 + i * 30, {
          company_name: "Restaurante Parrilla La Estancia de Don Alberto Palermo Soho Gran Buenos Aires",
          pay_amount: i === 0 ? "1250000" : "25000",
        })
      );
      await inicio(page, ocho, tema);
      await expect(page.locator("html")).toHaveAttribute("data-theme", tema);
      const urgentes = region(page);
      await expect(urgentes.getByTestId("feed-urgente-card")).toHaveCount(8);
      expect(await sinScrollDePagina(page)).toBe(true);
      // El carril es el que scrollea.
      const carril = await urgentes.locator("ul").evaluate((el) => ({ sobra: el.scrollWidth > el.clientWidth, ox: getComputedStyle(el).overflowX }));
      expect(carril).toEqual({ sobra: true, ox: "auto" });
      // Ninguna tarjeta es más ancha que la pantalla.
      for (const caja of await urgentes.getByTestId("feed-urgente-card").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width))) {
        expect(caja).toBeLessThanOrEqual(ancho);
      }
      // Ámbar = la familia `primary` (y las estrellas): nada de la sección la usa.
      const ambar = await urgentes.evaluate((el) => {
        const raiz = getComputedStyle(document.documentElement);
        const probe = document.createElement("i");
        document.body.appendChild(probe);
        const resolver = (v: string) => {
          probe.style.color = `var(${v})`;
          return getComputedStyle(probe).color;
        };
        const prohibidos = new Set(["--color-primary", "--color-primary-strong", "--color-primary-text", "--color-primary-tint", "--color-rating"].map(resolver));
        probe.remove();
        void raiz;
        const usados: string[] = [];
        for (const e of [el, ...el.querySelectorAll("*")]) {
          const cs = getComputedStyle(e);
          for (const c of [cs.color, cs.backgroundColor, cs.borderTopColor, cs.fill]) if (prohibidos.has(c)) usados.push(`${e.tagName}:${c}`);
        }
        return { usados, boton: el.querySelectorAll(".boton-relieve").length };
      });
      expect(ambar).toEqual({ usados: [], boton: 0 });
    });
  }
}

test("con la letra al 200 % la fila no desborda la página", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await inicio(page, TRES());
  await page.addStyleTag({ content: "html { font-size: 32px !important; }" });
  await expect(region(page)).toBeVisible();
  expect(await sinScrollDePagina(page)).toBe(true);
  for (const caja of await region(page).getByTestId("feed-urgente-card").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width))) {
    expect(caja).toBeLessThanOrEqual(390);
  }
});

test("en la compu (1280) la fila va arriba de la grilla y no desborda", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await inicio(page, TRES());
  await expect(region(page).getByTestId("feed-urgente-card")).toHaveCount(3);
  await expect(page.getByTestId("feed-grid-card").first()).toBeVisible();
  const alto = (loc: ReturnType<Page["locator"]>) => loc.evaluate((el) => el.getBoundingClientRect().top);
  expect(await alto(region(page))).toBeLessThan(await alto(page.getByTestId("feed-grid-card").first()));
  expect(await sinScrollDePagina(page)).toBe(true);
});
