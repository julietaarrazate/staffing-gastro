import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * Guarda de rol por URL en `/feed` (trabajador) y `/search` (comercio y admin),
 * el mismo mecanismo que el resto (`useRequireAuth({ roles })`, U098): un rol
 * equivocado va a la home de su rol y la pantalla no dispara sus pedidos.
 */

function me(role: string) {
  return {
    id: "user-1",
    email: "demo@staffya.com",
    full_name: "Persona Demo",
    role,
    status: "activo",
    is_active: true,
    is_verified: true,
  };
}

async function setup(page: Page, role: string) {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  // Cualquier otro pedido a la API: lista vacía (y se anota cuáles llegan).
  await page.route("**/api/v1/**", (route) => {
    const url = route.request().url();
    if (url.includes("/auth/me")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(me(role)) });
    }
    if (url.includes("/companies/me/profile")) {
      // Con local cargado el comercio busca solo, y eso prueba que no lo sacaron.
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "company-1", user_id: "user-1", name: "Bar Central", latitude: -34.58, longitude: -58.42, city: "Palermo" }),
      });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

test("un comercio que entra por URL a /feed va a su panel", async ({ page }) => {
  await setup(page, "employer");
  await page.goto("/feed");
  await expect(page).toHaveURL(/\/shifts$/);
});

test("un trabajador que entra por URL a /search va a su feed", async ({ page }) => {
  await setup(page, "worker");
  await page.goto("/search");
  await expect(page).toHaveURL(/\/feed$/);
});

test("el trabajador sigue en /feed", async ({ page }) => {
  await setup(page, "worker");
  await page.goto("/feed");
  await expect(page).toHaveURL(/\/feed$/);
});

for (const role of ["employer", "admin"]) {
  test(`${role} sigue en /search`, async ({ page }) => {
    await setup(page, role);
    const busca = page.waitForRequest("**/api/v1/matching/search**");
    await page.goto("/search");
    await busca;
    await expect(page).toHaveURL(/\/search/);
  });
}
