import { test, expect, type Page } from "@playwright/test";
import { deContrato, fulfillContrato } from "./contrato";
import { blockExternalHosts, injectSession, isoEnDias, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

/**
 * Mis turnos con la dirección suave (ADR-0028, maqueta `T-Mis-turnos`;
 * docs/historial/2026-11-20-mis-turnos-direccion-suave.md): el cielo con el
 * título y la semana, la hoja, el turno de hoy como tarjeta con su propio
 * cielo y el único ámbar, y los demás como filas.
 */
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
// Reloj fijo, hoy a las 18:30 de Argentina: el turno de hoy empieza en una
// hora (ya se puede avisar «voy en camino», todavía no «Llegué»).
const AHORA = new Date(isoEnDias(0, "18:30"));
// Turno de `GET /shifts/mine` y sesión: respuestas reales del backend (e2e/contrato).
const turno = (o: Record<string, unknown>) => deContrato("turnos_asignados_trabajador", [{ company_name: "Bar Lavalle", ...o }])[0];
const TURNOS = () => [
  turno({ id: "hoy", position: "bartender", status: "confirmado", start_at: isoEnDias(0, "19:30"), end_at: isoEnDias(1, "01:30") }),
  turno({ id: "s1", position: "mozo", status: "confirmado", start_at: isoEnDias(1, "21:00"), end_at: isoEnDias(2, "02:00") }),
  turno({ id: "s2", position: "mozo", status: "pagado", start_at: isoEnDias(-3, "21:00"), end_at: isoEnDias(-2, "02:00") }),
];

async function misTurnos(page: Page, turnos: unknown[] = TURNOS()) {
  await page.clock.setFixedTime(AHORA);
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  // Catch-all primero: Playwright resuelve la última ruta registrada.
  await page.route("**/api/v1/**", (r) => (r.request().method() === "GET" ? r.fulfill(json([])) : r.continue()));
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => fulfillContrato(r, "auth_me_worker"));
  await page.route("**/api/v1/shifts/mine**", (r) => r.fulfill(json(turnos)));
  await page.goto("/my-shifts");
}

for (const theme of ["light", "dark"] as const) {
  test(`${theme}: el título y la semana van sobre el cielo y se leen; hoy es una tarjeta con su cielo y los demás, filas`, async ({ page }) => {
    await setTheme(page, theme);
    await misTurnos(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    const titulo = page.getByRole("heading", { level: 1, name: "Matches" });
    await expect(titulo).toHaveClass(/titulo-pantalla/);
    await expect(titulo).not.toHaveClass(/letra-cartel/);
    // La tinta del cielo: azul hondo de día, clara de noche.
    const cielo = page.locator(".estilo-suave > .app-cielo");
    await expect(cielo).toContainText("Matches");
    expect(await titulo.evaluate((el) => getComputedStyle(el).color)).toBe(
      theme === "light" ? "rgb(15, 58, 91)" : "rgb(238, 243, 246)",
    );

    // La semana: siete días, hoy marcado, y un punto en los días con turno por hacer.
    const semana = page.getByRole("list", { name: "Esta semana" });
    await expect(semana.getByRole("listitem")).toHaveCount(7);
    await expect(semana.locator(".dia-cielo-hoy")).toHaveCount(1);
    const hoy = isoEnDias(0).slice(0, 10);
    await expect(semana.locator(`[data-dia="${hoy}"]`)).toContainText(", hoy, con turno");
    await expect(semana.locator(`[data-dia="${hoy}"] .dia-cielo-hoy`)).toHaveCSS("background-color", "rgb(255, 255, 255)");

    // Hoy: la tarjeta con su propio cielo, el estado y los cuatro pasos.
    const deHoy = page.locator('[data-shift-id="hoy"]');
    await expect(deHoy).toHaveAttribute("data-turno", "destacado");
    await expect(deHoy.locator(".app-cielo")).toContainText("Hoy");
    await expect(deHoy.locator(".app-cielo").getByRole("heading", { level: 3 })).toHaveText("Bartender");
    await expect(deHoy.getByTestId("shift-status")).toHaveText("Confirmado");
    await expect(deHoy.locator(".pasos-barras > li")).toHaveCount(4);
    await expect(deHoy.locator('.pasos-barras > li[aria-current="step"]')).toHaveText("Aceptado");

    // Los demás, filas; lo pagado queda hundido (sin sombra), no transparente.
    const fila = page.locator('[data-shift-id="s1"]');
    await expect(fila).toHaveAttribute("data-turno", "fila");
    await expect(fila.getByTestId("shift-status")).toHaveText("Confirmado");
    const pagado = page.locator('[data-shift-id="s2"]');
    await expect(pagado).toHaveClass(/turno-apagado/);
    await expect(pagado).toHaveCSS("box-shadow", "none");
    await expect(pagado).toHaveCSS("opacity", "1");

    // Nada del marrón por rubro ni de la comanda.
    await expect(page.locator(".comanda, .sello-goma, .app-banda")).toHaveCount(0);
  });
}

test("un solo ámbar en la pantalla: el de la tarjeta de hoy; en las filas las mismas acciones van quietas", async ({ page }) => {
  await misTurnos(page);
  const deHoy = page.locator('[data-shift-id="hoy"]');
  await expect(deHoy).toBeVisible();
  const ambar = page.locator("button.boton-relieve:not(:disabled)");
  await expect(ambar).toHaveCount(1);
  await expect(ambar).toHaveText("Voy en camino");
  await expect(deHoy.getByRole("button", { name: "Voy en camino" })).toHaveClass(/boton-relieve/);
  // Las mismas acciones de siempre, en la tarjeta y en la fila.
  for (const id of ["hoy", "s1"]) {
    const t = page.locator(`[data-shift-id="${id}"]`);
    await expect(t.getByRole("link", { name: "Chatear" })).toHaveAttribute("href", `/chats/${id}`);
    await expect(t.getByRole("button", { name: "Llegué" })).toBeDisabled();
    await expect(t.getByRole("button", { name: /Cancelar mi asignación/ })).toBeEnabled();
    await expect(t.getByRole("button", { name: "Voy en camino" })).toBeVisible();
    await expect(t.getByRole("button", { name: "Agendar" })).toBeVisible();
    await expect(t.getByRole("link", { name: "Reportar un problema" })).toBeVisible();
  }
  await expect(page.locator('[data-shift-id="s1"]').getByRole("button", { name: "Voy en camino" })).not.toHaveClass(/boton-relieve/);
});

test("desde 30 min antes el ámbar pasa a «Llegué»", async ({ page }) => {
  await misTurnos(page, [
    turno({ id: "hoy", position: "bartender", status: "confirmado", start_at: isoEnDias(0, "18:50"), end_at: isoEnDias(1, "01:00") }),
  ]);
  const ambar = page.locator("button.boton-relieve:not(:disabled)");
  await expect(ambar).toHaveCount(1);
  await expect(ambar).toHaveText("Llegué");
});

test("sin turno hoy no hay tarjeta destacada ni ámbar", async ({ page }) => {
  await misTurnos(page, [TURNOS()[1]]);
  await expect(page.locator('[data-shift-id="s1"]')).toHaveAttribute("data-turno", "fila");
  await expect(page.locator('[data-turno="destacado"]')).toHaveCount(0);
  await expect(page.locator("button.boton-relieve:not(:disabled)")).toHaveCount(0);
});

test("un turno viejo sin cerrar o con la salida ya marcada no se queda con la tarjeta de hoy", async ({ page }) => {
  // Un asignado de hace dos días que nadie cerró y uno con la salida marcada
  // al mediodía: ninguno tiene acción ahora. El de las 19:30 sí.
  await misTurnos(page, [
    turno({ id: "viejo", position: "mozo", status: "asignado", start_at: isoEnDias(-2, "20:00"), end_at: isoEnDias(-1, "02:00") }),
    turno({ id: "salio", position: "mozo", status: "check_out", start_at: isoEnDias(0, "08:00"), end_at: isoEnDias(0, "12:00") }),
    TURNOS()[0],
  ]);
  await expect(page.locator('[data-shift-id="hoy"]')).toHaveAttribute("data-turno", "destacado");
  await expect(page.locator('[data-shift-id="viejo"]')).toHaveAttribute("data-turno", "fila");
  await expect(page.locator('[data-shift-id="salio"]')).toHaveAttribute("data-turno", "fila");
  await expect(page.locator("button.boton-relieve:not(:disabled)")).toHaveText("Voy en camino");
});

test("con un turno en marcha, la tarjeta de hoy y el ámbar son suyos aunque haya otro por empezar", async ({ page }) => {
  await misTurnos(page, [
    turno({ id: "luego", position: "mozo", status: "asignado", start_at: isoEnDias(0, "20:00"), end_at: isoEnDias(1, "01:00") }),
    turno({ id: "ahora", position: "bartender", status: "trabajando", start_at: isoEnDias(0, "17:00"), end_at: isoEnDias(0, "19:30") }),
  ]);
  await expect(page.locator('[data-shift-id="ahora"]')).toHaveAttribute("data-turno", "destacado");
  await expect(page.locator('[data-shift-id="luego"]')).toHaveAttribute("data-turno", "fila");
  await expect(page.locator("button.boton-relieve:not(:disabled)")).toHaveText("Marcar salida");
});

for (const theme of ["light", "dark"] as const) {
  test(`${theme}: lo quieto se lee (letra contra su relleno, 4,5 o más) en la tarjeta, en la fila y en lo apagado`, async ({ page }) => {
    await setTheme(page, theme);
    await misTurnos(page);
    await expect(page.locator('[data-shift-id="s2"]')).toBeVisible();
    const contrastes = await page.evaluate(() => {
      const canal = (v: number) => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      const luz = (c: string) => {
        const [r, g, b] = c.match(/[\d.]+/g)!.map(Number);
        return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
      };
      return [...document.querySelectorAll<HTMLElement>('[data-testid="shift-card"] .boton-quieto:not(:disabled)')].map((el) => {
        const e = getComputedStyle(el);
        const [a, b] = [luz(e.color), luz(e.backgroundColor)].sort((x, y) => y - x);
        return { texto: el.textContent, contraste: Math.round(((a + 0.05) / (b + 0.05)) * 10) / 10 };
      });
    });
    expect(contrastes.length).toBeGreaterThan(5);
    expect(contrastes.filter((c) => c.contraste < 4.5)).toEqual([]);
  });
}

for (const ancho of [320, 360]) {
  test(`a ${ancho} px nada corre la página ni se sale de su tarjeta`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 740 });
    await misTurnos(page);
    await expect(page.locator('[data-shift-id="s2"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const salidos = await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="shift-card"]')].flatMap((card) => {
        const c = card.getBoundingClientRect();
        return [...card.querySelectorAll("button, a, li, h3, p")]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && (r.left < c.left - 0.5 || r.right > c.right + 0.5);
          })
          .map((el) => el.textContent);
      }),
    );
    expect(salidos).toEqual([]);
  });
}

test("«Enviar calificación» va en azul hondo: con las estrellas puestas no suma un segundo ámbar", async ({ page }) => {
  // 2026-11-20 (PR del panel del comercio): `ReviewBox` es la misma pieza en
  // las dos pantallas y su botón era ámbar apenas se elegía una estrella.
  await misTurnos(page);
  const pagado = page.locator('[data-shift-id="s2"]');
  const enviar = pagado.getByRole("button", { name: "Enviar calificación" });
  await expect(enviar).toBeDisabled();
  await pagado.getByRole("button", { name: "4 estrellas" }).click();
  await expect(enviar).toBeEnabled();
  await expect(enviar).toHaveClass(/boton-hondo/);
  await expect(enviar).not.toHaveClass(/boton-relieve/);
  await expect(enviar).toHaveCSS("color", "rgb(255, 255, 255)");
  expect(await enviar.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain("rgb(42, 115, 163)");
  await expect(page.locator("button.boton-relieve:not(:disabled)")).toHaveCount(1);
});
