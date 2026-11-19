import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

/**
 * Buscar del comercio con la dirección «con relieve» (2026-11-19,
 * docs/historial/2026-11-19-buscar-comercio-relieve.md): la barra de búsqueda
 * recta y lisa con la lupa ámbar con relieve, los pines en azul hondo y cada
 * trabajador en su ficha blanca con filete; quien está «Disponible ahora»,
 * con el relieve del filete. Se mide renderizado, en claro y de noche.
 */
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const EMPLOYER = { id: "u-e", email: "e@oido.test", full_name: "Julieta Demo", role: "employer", status: "activo", is_active: true, is_verified: true };
const trabajador = (id: string, nombre: string, extra: Record<string, unknown> = {}) => ({
  profile_id: id, user_id: `u-${id}`, full_name: nombre, photo_url: null, rating: 4.6, distance_km: 1.2, latitude: -34.585, longitude: -58.43,
  skills: ["mozo"], is_live: false, position_updated_at: null, ...extra,
});

async function buscar(page: Page, theme: "light" | "dark") {
  await setTheme(page, theme);
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  // Catch-all primero: Playwright resuelve la última ruta registrada.
  await page.route("**/api/v1/**", (r) => (r.request().method() === "GET" ? r.fulfill(json([])) : r.continue()));
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json(EMPLOYER)));
  await page.route("**/api/v1/companies/me/profile", (r) =>
    r.fulfill(json({ id: "c1", user_id: "u-e", name: "Bar Central", logo_url: null, category: null, description: null, address: "Honduras 5200", city: "Palermo, CABA", latitude: -34.5875, longitude: -58.4257, capacity: null, opening_hours: null, rating: 4.5, events_published: 0, on_time_payment_rate: 1, late_cancellations: 0 })),
  );
  await page.route("**/api/v1/matching/search**", (r) =>
    r.fulfill(json([
      trabajador("w1", "Sofía Ramírez", { is_live: true, position_updated_at: new Date(Date.now() - 5 * 60_000).toISOString(), skills: ["bartender", "mozo"] }),
      trabajador("w2", "Lucas Medina"),
    ])),
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/search");
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

const contraste = (a: string, b: string) => {
  const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
  const lum = ([r, g, bl]: number[]) => {
    const x = [r, g, bl].map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * x[0] + 0.7152 * x[1] + 0.0722 * x[2];
  };
  const [p, q] = [lum(rgb(a)), lum(rgb(b))].sort((m, n) => n - m);
  return (p + 0.05) / (q + 0.05);
};

for (const theme of ["light", "dark"] as const) {
  test(`${theme}: barra recta con la lupa con relieve, fichas con filete y la disponible con relieve`, async ({ page }) => {
    await buscar(page, theme);
    const panel = page.locator("aside");
    await expect(panel.getByText("Sofía Ramírez")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Buscar" })).toHaveClass(/boton-relieve/);
    await expect(panel.getByRole("combobox")).toHaveCSS("border-top-left-radius", "6px");

    const fichas = panel.getByRole("link").filter({ hasText: /Ramírez|Medina/ });
    await expect(fichas).toHaveCount(2);
    await expect(fichas.filter({ hasText: "Sofía Ramírez" })).toHaveClass(/tarjeta-relieve/);
    await expect(fichas.filter({ hasText: "Lucas Medina" })).not.toHaveClass(/tarjeta-relieve/);

    // Todo lo escrito en las fichas se lee (antes la distancia iba en ink/40).
    const peor = await fichas.evaluateAll((links) =>
      links.flatMap((link) => {
        const bg = getComputedStyle(link).backgroundColor;
        return [...link.querySelectorAll("p, span")]
          .filter((el) => el.children.length === 0 && (el.textContent ?? "").trim().length > 1)
          .map((el) => ({ t: el.textContent, c: getComputedStyle(el).color, bg: getComputedStyle(el.closest("[class*='bg-surface']") ?? link).backgroundColor || bg }));
      }),
    );
    for (const p of peor) expect(contraste(p.c, p.bg), String(p.t)).toBeGreaterThanOrEqual(4.5);
  });
}

test("a 320 px la barra entra entera: el rubro se achica y la lupa queda a la vista", async ({ page }) => {
  await buscar(page, "light");
  await page.setViewportSize({ width: 320, height: 700 });
  const lupa = page.locator("main").getByRole("button", { name: "Buscar" }).first();
  await expect(lupa).toBeVisible();
  const caja = (await lupa.boundingBox())!;
  expect(caja.x + caja.width).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});
