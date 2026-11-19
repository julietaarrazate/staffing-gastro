import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, isoEnDias, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

/**
 * Los colores de los sellos (2026-11-19, docs/historial/2026-11-19-colores-de-los-sellos.md):
 * cuatro tintas fijas sobre el papel de la comanda, que es claro en los dos
 * temas. Verde lo que salió bien (con «llegó»), azul hondo lo que está en
 * curso, rojo cancelado y «Urgente», gris lo que no arrancó o no se cubrió.
 * Cada sello se lee (4,5) sobre el papel de día y sobre el de noche.
 */
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const EMPLOYER = { id: "u-e", email: "e@oido.test", full_name: "Julieta Demo", role: "employer", status: "activo", is_active: true, is_verified: true };
const turno = (id: string, status: string, extra: Record<string, unknown> = {}) => ({
  id, company_id: "c1", position: "mozo", quantity: 1, start_at: isoEnDias(1, "21:00"), end_at: isoEnDias(2, "02:00"), pay_amount: "20000", currency: "ARS",
  tips: true, meal: false, dress_code: null, urgent: false, address: null, city: "Palermo, CABA", latitude: null, longitude: null,
  title: null, description: null, status, worker_profile_id: ["publicado", "borrador", "cancelado", "no_cubierto"].includes(status) ? null : "wp-1",
  created_at: "2026-07-01T12:00:00-03:00", company_name: "Bar Lavalle", company_logo_url: null, ...extra,
});

const TINTA: Record<string, string> = {
  verde: "rgb(22, 101, 52)",
  azul: "rgb(28, 84, 120)",
  rojo: "rgb(194, 47, 47)",
  gris: "rgb(75, 85, 99)",
};
const ESTADOS: [string, keyof typeof TINTA][] = [
  ["publicado", "azul"],
  ["asignado", "azul"],
  ["confirmado", "verde"],
  ["en_camino", "azul"],
  ["check_in", "verde"],
  ["finalizado", "verde"],
  ["pagado", "verde"],
  ["cancelado", "rojo"],
  ["no_cubierto", "gris"],
];

async function panel(page: Page, theme: "light" | "dark") {
  await setTheme(page, theme);
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  // Catch-all primero: Playwright resuelve la última ruta registrada.
  await page.route("**/api/v1/**", (r) => (r.request().method() === "GET" ? r.fulfill(json([])) : r.continue()));
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json(EMPLOYER)));
  await page.route("**/api/v1/shifts/me", (r) =>
    r.fulfill(json([...ESTADOS.map(([s]) => turno(`s-${s}`, s)), turno("s-urgente", "publicado", { urgent: true })])),
  );
  await page.goto("/shifts");
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

for (const theme of ["light", "dark"] as const) {
  test(`${theme}: cada estado con su tinta, y todos se leen sobre el papel`, async ({ page }) => {
    await panel(page, theme);
    for (const [estado, tinta] of ESTADOS) {
      const comanda = page.locator(`[data-shift-id="s-${estado}"]`);
      await expect(comanda).toBeVisible();
      const sello = comanda.getByTestId("shift-status");
      await expect(sello, estado).toHaveCSS("color", TINTA[tinta]);
      const contraste = await sello.evaluate((el) => {
        const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
        const lum = ([r, g, b]: number[]) => {
          const x = [r, g, b].map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
          return 0.2126 * x[0] + 0.7152 * x[1] + 0.0722 * x[2];
        };
        const papel = getComputedStyle(el.closest(".comanda") as HTMLElement).backgroundColor;
        const [p, q] = [lum(rgb(getComputedStyle(el).color)), lum(rgb(papel))].sort((m, n) => n - m);
        return (p + 0.05) / (q + 0.05);
      });
      expect(contraste, `${theme}, ${estado}`).toBeGreaterThanOrEqual(4.5);
    }
    // «Urgente» va en el rojo de los sellos.
    await expect(page.locator('[data-shift-id="s-urgente"]').getByText("Urgente", { exact: true })).toHaveCSS("color", TINTA.rojo);
  });
}
