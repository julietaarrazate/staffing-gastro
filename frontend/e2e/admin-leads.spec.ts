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
  await expect(page.getByText("Bodegón Don Pepe")).toBeVisible();
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
    await expect(page.getByText("Café Tranquilo")).toBeVisible();
    await page.screenshot({
      path: `test-results/admin-leads-${theme}.png`,
      fullPage: true,
    });
  });
}
