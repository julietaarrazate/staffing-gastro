import { test, expect, type Page } from "@playwright/test";
import { AHORA_JUEVES, blockExternalHosts, injectSession, isoDesdeJueves, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

/**
 * Las pestañas con la dirección «con relieve» (2026-11-19,
 * docs/historial/2026-11-19-pestanas-relieve.md): texto plano sobre un
 * filete, la activa en tinta con una raya azul hondo debajo. Sin píldora. Se
 * mide renderizado: la raya, el contraste de los nombres y que el contorno de
 * foco no quede cortado. (El Panel del comercio ya no tiene pestañas desde el
 * 2026-11-21: la lista va agrupada por estado, con la tira de días.)
 */
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const WORKER = { id: "user-1", email: "w@oido.test", full_name: "Sofía Demo", role: "worker", status: "activo", is_active: true, is_verified: true };
const turno = (id: string, status: string, position: string) => ({
  id, company_id: "c1", position, quantity: 1, start_at: isoDesdeJueves(1, "21:00"), end_at: isoDesdeJueves(2, "02:00"), pay_amount: "20000", currency: "ARS",
  tips: true, meal: false, dress_code: null, urgent: false, address: null, city: "Palermo, CABA", latitude: null, longitude: null,
  title: null, description: null, status, worker_profile_id: status === "publicado" ? null : "wp-1", created_at: "2026-07-01T12:00:00-03:00", company_name: "Bar Lavalle", company_logo_url: null,
});

async function abrir(page: Page, theme: "light" | "dark", user: object) {
  // Reloj fijo: con `isoEnDias`, un domingo el turno de mañana caía en la
  // semana siguiente y la tira de días lo dejaba afuera.
  await page.clock.setFixedTime(AHORA_JUEVES);
  await setTheme(page, theme);
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  // Catch-all primero: Playwright resuelve la última ruta registrada.
  await page.route("**/api/v1/**", (r) => (r.request().method() === "GET" ? r.fulfill(json([])) : r.continue()));
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json(user)));
}

// Raya, fondos y contraste de cada pestaña, contra el fondo que tiene detrás.
const medir = (page: Page) =>
  page.locator("[data-pestanas]").first().evaluate((pista) => {
    const rgb = (s: string) => (s.match(/[\d.]+/g) ?? []).map(Number);
    const lum = ([r, g, b]: number[]) => {
      const c = [r, g, b].map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const ratio = (a: string, b: string) => {
      const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    // El fondo efectivo: el primer ancestro con fondo opaco.
    let el: Element | null = pista;
    let fondo = "rgb(255, 255, 255)";
    while (el) {
      const bg = getComputedStyle(el).backgroundColor;
      if (bg.startsWith("rgb(")) { fondo = bg; break; }
      el = el.parentElement;
    }
    return {
      fondoPista: getComputedStyle(pista).backgroundColor,
      pestanas: [...pista.querySelectorAll(":scope > button")].map((b) => {
        const raya = b.querySelector(":scope > span[aria-hidden]") as HTMLElement | null;
        const nombre = b.querySelector(":scope > span:not([aria-hidden])") as HTMLElement;
        return {
          activa: b.getAttribute("aria-pressed") === "true",
          letra: ratio(getComputedStyle(nombre).color, fondo),
          raya: raya ? { alto: raya.getBoundingClientRect().height, contraste: ratio(getComputedStyle(raya).backgroundColor, fondo) } : null,
          fondoBoton: getComputedStyle(b).backgroundColor,
        };
      }),
    };
  });

for (const theme of ["light", "dark"] as const) {
  test(`${theme}: en Mis turnos la activa lleva la raya, sin píldora, y los nombres se leen`, async ({ page }) => {
    await abrir(page, theme, WORKER);
    await page.route("**/api/v1/shifts/mine**", (r) => r.fulfill(json([turno("s1", "confirmado", "bartender")])));
    await page.goto("/my-shifts");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.locator('[data-shift-id="s1"]')).toBeVisible();
    const m = await medir(page);
    expect(m.fondoPista).toBe("rgba(0, 0, 0, 0)");
    expect(m.pestanas).toHaveLength(3);
    for (const p of m.pestanas) {
      expect(p.fondoBoton).toBe("rgba(0, 0, 0, 0)");
      expect(p.letra).toBeGreaterThanOrEqual(4.5);
      if (p.activa) {
        // 3 px, con tolerancia: la raya entra animada y el alto medido puede
        // venir con un resto de subpíxel (3,0000153 en CI el 2026-11-20, tres
        // veces en un día y en PRs que no tocaban esta pantalla).
        expect(p.raya?.alto).toBeCloseTo(3, 2);
        expect(p.raya!.contraste).toBeGreaterThanOrEqual(3);
      } else {
        expect(p.raya).toBeNull();
      }
    }
    // La raya pasa a la pestaña que se toca.
    await page.getByRole("button", { name: /^Guardados/ }).click();
    await expect(page.getByRole("button", { name: /^Guardados/ })).toHaveAttribute("aria-pressed", "true");
    const despues = await medir(page);
    expect(despues.pestanas.map((p) => p.raya !== null)).toEqual([false, false, true]);
  });
}

test("a 320 px, Mis turnos con contadores de una cifra muestra los tres nombres enteros", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await abrir(page, "light", WORKER);
  await page.route("**/api/v1/shifts/mine**", (r) => r.fulfill(json([turno("s1", "confirmado", "bartender"), turno("s2", "confirmado", "mozo")])));
  await page.route("**/api/v1/applications/mine**", (r) =>
    r.fulfill(json([1, 2, 3].map((i) => ({ id: `a${i}`, shift_id: `p${i}`, worker_profile_id: "wp-1", status: "pendiente", created_at: isoDesdeJueves(-1), shift: turno(`p${i}`, "publicado", "mozo") })))),
  );
  await page.route("**/api/v1/saved-shifts", (r) => (r.request().method() === "GET" ? r.fulfill(json([turno("g1", "publicado", "barista"), turno("g2", "publicado", "cocinero")])) : r.continue()));
  await page.goto("/my-shifts");
  await expect(page.locator('[data-shift-id="s1"]')).toBeVisible();
  // Se mide con Inter ya cargada: con la letra de respaldo, más ancha, el
  // nombre se recorta (en la primera corrida de CI se recortó «Asignados»).
  await page.evaluate(() => document.fonts.ready);
  for (const name of [/^Asignados/, /^Postulaciones/, /^Guardados/]) {
    const boton = page.locator("[data-pestanas]").getByRole("button", { name });
    await expect(boton).toBeVisible();
    expect(await boton.locator(".truncate").evaluate((el) => el.scrollWidth > el.clientWidth), String(name)).toBe(false);
  }
});
