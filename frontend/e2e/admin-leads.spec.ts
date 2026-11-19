import { test, expect, type Page } from "@playwright/test";
import {
  blockExternalHosts,
  injectSession,
  mockEmptyNotifications,
  setTheme,
  skipSplash,
} from "./mocks";

/**
 * Comercios a captar (`/admin/leads`, ADR-0019): la admin trae los comercios
 * de un barrio desde OpenStreetMap y va marcando el seguimiento. API mockeada.
 */

const ADMIN_SESSION = {
  id: "admin-1",
  email: "julietaarrazate@gmail.com",
  full_name: "Julieta Admin",
  role: "admin",
  status: "active",
  is_active: true,
  is_verified: true,
};

const LEADS = [
  {
    id: "lead-1",
    osm_ref: "node/1",
    name: "Bodegón Don Pepe",
    kind: "restaurante",
    barrio: "Palermo",
    latitude: -34.58,
    longitude: -58.43,
    address: "Honduras 4800",
    phone: "+54 11 5555-0000",
    website: null,
    instagram: "donpepe",
    email: null,
    status: "nuevo",
    notes: "",
    priority: 5,
    contacted_at: null,
    updated_at: null,
  },
  {
    id: "lead-2",
    osm_ref: "way/2",
    name: "Café Tranquilo",
    kind: "cafe",
    barrio: "Palermo",
    latitude: -34.59,
    longitude: -58.42,
    address: null,
    phone: null,
    website: null,
    instagram: null,
    email: null,
    status: "visitado",
    notes: "Volver el martes",
    priority: 2,
    contacted_at: "2026-10-18T15:00:00Z",
    updated_at: null,
  },
];

const SUMMARY = {
  counts: { nuevo: 1, contactado: 0, visitado: 1, interesado: 0, alta: 0, descartado: 0 },
  total: 2,
};

async function mockLeads(page: Page, onPatch?: (body: unknown) => void) {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ADMIN_SESSION) })
  );
  await page.route("**/api/v1/admin/leads/barrios", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(["Palermo", "Villa Crespo"]) })
  );
  await page.route("**/api/v1/admin/leads/summary**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(SUMMARY) })
  );
  await page.route("**/api/v1/admin/leads/import", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ barrio: "Palermo", found: 2, created: 0, updated: 2 }),
    })
  );
  await page.route(/\/api\/v1\/admin\/leads(\?.*)?$/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(LEADS) })
  );
  await page.route("**/api/v1/admin/leads/lead-1", (route) => {
    const body = route.request().postDataJSON();
    onPatch?.(body);
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...LEADS[0], ...body }),
    });
  });
}

async function setup(page: Page, onPatch?: (body: unknown) => void) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockLeads(page, onPatch);
}

test("lista los comercios por prioridad, importa y cambia el estado", async ({ page }) => {
  let patched: unknown = null;
  await setup(page, (body) => {
    patched = body;
  });
  await page.goto("/admin/leads");

  await expect(page.getByRole("heading", { name: "Comercios a captar" })).toBeVisible();
  await expect(page.getByText("Bodegón Don Pepe").first()).toBeVisible();
  await expect(page.getByText("Prioridad alta")).toBeVisible();
  await expect(page.getByRole("link", { name: "Instagram" })).toHaveAttribute(
    "href",
    "https://www.instagram.com/donpepe/"
  );
  await expect(page.getByRole("button", { name: "Todos · 2" })).toBeVisible();

  await page.getByRole("button", { name: "Traer comercios del barrio" }).click();
  await expect(page.getByText("2 comercios: 0 nuevos, 2 actualizados")).toBeVisible();

  await page.getByLabel("Estado de Bodegón Don Pepe").selectOption("contactado");
  await expect.poll(() => patched).toEqual({ status: "contactado" });
});

for (const theme of ["light", "dark"] as const) {
  test(`captura de la pantalla en tema ${theme}`, async ({ page }) => {
    await setTheme(page, theme);
    await setup(page);
    await page.goto("/admin/leads");
    await expect(page.getByText("Café Tranquilo").first()).toBeVisible();
    await page.screenshot({
      path: `test-results/admin-leads-${theme}.png`,
      fullPage: true,
    });
  });
}

test("Imprimir llama a window.print y en papel sólo queda la lista", async ({ page }) => {
  await setup(page);
  await page.addInitScript(() => {
    (window as unknown as { __prints: number }).__prints = 0;
    window.print = () => {
      (window as unknown as { __prints: number }).__prints += 1;
    };
  });
  await page.goto("/admin/leads");
  await expect(page.getByText("Café Tranquilo").first()).toBeVisible();

  // En pantalla la tabla imprimible no se ve.
  const hoja = page.getByTestId("comercios-imprimir");
  await expect(hoja).toBeHidden();

  await page.getByRole("button", { name: "Imprimir" }).click();
  expect(await page.evaluate(() => (window as unknown as { __prints: number }).__prints)).toBe(1);

  await page.emulateMedia({ media: "print" });
  await expect(hoja).toBeVisible();
  await expect(hoja.getByRole("heading", { name: "Comercios a captar · Palermo" })).toBeVisible();
  await expect(hoja.getByText(/Todos · 2 comercios · impreso el \d{1,2}\/\d{1,2}\/\d{4}/)).toBeVisible();
  await expect(hoja.getByRole("cell", { name: "Bodegón Don Pepe" })).toBeVisible();
  await expect(hoja.getByRole("cell", { name: "Café Tranquilo" })).toBeVisible();
  await expect(hoja.getByText("Datos de comercios © colaboradores de OpenStreetMap (ODbL)")).toBeVisible();
  // Sin barras ni menú del admin.
  await expect(page.getByRole("navigation", { name: "Secciones del panel" })).toBeHidden();
  await expect(page.getByRole("navigation", { name: "Principal" })).toBeHidden();
  await expect(page.getByRole("navigation", { name: "Secciones", exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: "CSV" })).toBeHidden();
});

for (const theme of ["light", "dark"] as const) {
  test(`captura de la hoja impresa en tema ${theme}`, async ({ page }) => {
    // A4 vertical a 96 dpi, para ver las 6 columnas como en papel.
    await page.setViewportSize({ width: 794, height: 1123 });
    await setTheme(page, theme);
    await setup(page);
    await page.goto("/admin/leads");
    await expect(page.getByText("Café Tranquilo").first()).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await page.emulateMedia({ media: "print" });
    await expect(page.getByTestId("comercios-imprimir")).toBeVisible();
    await page.screenshot({
      path: `test-results/admin-leads-imprimir-${theme}.png`,
      fullPage: true,
    });
  });
}
