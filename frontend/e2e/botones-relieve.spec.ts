import { test, expect, type Locator, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, isoEnDias, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

/**
 * Los botones secundarios con la dirección «con relieve» (2026-11-19,
 * docs/historial/2026-11-19-botones-secundarios-relieve.md): rectos como el
 * principal (10 px), blancos con filete y planos; el relieve queda para el
 * principal. Se mide renderizado, en claro y de noche.
 */
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const EMPLOYER = { id: "u-e", email: "e@oido.test", full_name: "Julieta Demo", role: "employer", status: "activo", is_active: true, is_verified: true };
const turno = (id: string, status: string, position: string) => ({
  id, company_id: "c1", position, quantity: 1, start_at: isoEnDias(1, "21:00"), end_at: isoEnDias(2, "02:00"), pay_amount: "20000", currency: "ARS",
  tips: true, meal: false, dress_code: null, urgent: false, address: null, city: "Palermo, CABA", latitude: null, longitude: null,
  title: null, description: null, status, worker_profile_id: status === "publicado" ? null : "wp-1", created_at: "2026-07-01T12:00:00-03:00", company_name: "Bar Lavalle", company_logo_url: null,
});

async function abrir(page: Page, theme: "light" | "dark", user: object) {
  await setTheme(page, theme);
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  // Catch-all primero: Playwright resuelve la última ruta registrada.
  await page.route("**/api/v1/**", (r) => (r.request().method() === "GET" ? r.fulfill(json([])) : r.continue()));
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json(user)));
}

// Radio, sombras y contraste de la letra contra el fondo del botón.
const forma = (boton: Locator) =>
  boton.evaluate((b) => {
    const rgb = (s: string) => (s.match(/[\d.]+/g) ?? []).map(Number);
    const lum = ([r, g, bl]: number[]) => {
      const c = [r, g, bl].map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const ratio = (a: string, c: string) => {
      const [x, y] = [lum(rgb(a)), lum(rgb(c))].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    const st = getComputedStyle(b);
    return {
      radio: st.borderTopLeftRadius,
      // Plano: sólo el filete de 1 px (ring), ninguna sombra corrida.
      sombraCorrida: [...st.boxShadow.matchAll(/(-?[\d.]+)px (-?[\d.]+)px (-?[\d.]+)px/g)].some(
        (m) => Number(m[1]) !== 0 || Number(m[2]) !== 0 || Number(m[3]) !== 0,
      ),
      contraste: ratio(st.color, st.backgroundColor),
    };
  });

for (const theme of ["light", "dark"] as const) {
  test(`${theme}: en el Panel, «Evento» y «Más» son rectos, planos y se leen`, async ({ page }) => {
    await abrir(page, theme, EMPLOYER);
    await page.route("**/api/v1/shifts/me", (r) => r.fulfill(json([turno("s1", "publicado", "mozo")])));
    await page.goto("/shifts");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.locator('[data-shift-id="s1"]')).toBeVisible();
    for (const boton of [
      page.getByRole("link", { name: "Evento" }),
      page.locator('[data-shift-id="s1"]').getByRole("button", { name: "Más acciones" }),
    ]) {
      const f = await forma(boton);
      expect(f.radio).toBe("10px");
      expect(f.sombraCorrida).toBe(false);
      expect(f.contraste).toBeGreaterThanOrEqual(4.5);
    }
    // El principal sigue siendo el único con relieve.
    await expect(page.getByRole("link", { name: /Publicar turno/ })).toHaveClass(/boton-relieve/);
  });
}
