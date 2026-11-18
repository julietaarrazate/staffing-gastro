import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * Guarda de rol por URL en `/feed` (trabajador) y `/search` (comercio y admin),
 * el mismo mecanismo que el resto (`useRequireAuth({ roles })`, U098): un rol
 * equivocado va a la home de su rol y la pantalla ni se monta: no sale el
 * pedido del feed ni la búsqueda, y no se le pide la ubicación al navegador.
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

async function setup(page: Page, role: string, demoraMeMs = 0) {
  // Cuenta las veces que algo le pide la ubicación al navegador.
  await page.addInitScript(() => {
    (window as unknown as { __geo: number }).__geo = 0;
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: () => {
          (window as unknown as { __geo: number }).__geo += 1;
        },
        watchPosition: () => {
          (window as unknown as { __geo: number }).__geo += 1;
          return 0;
        },
        clearWatch: () => {},
      },
    });
  });
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  const pedidos: string[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/auth/me")) {
      if (demoraMeMs) await new Promise((r) => setTimeout(r, demoraMeMs));
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(me(role)) });
    }
    pedidos.push(url);
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
  const geo = () => page.evaluate(() => (window as unknown as { __geo: number }).__geo);
  return { pedidos, geo };
}

const deFeed = (pedidos: string[]) => pedidos.filter((u) => /\/shifts\/feed/.test(u));
const deBusqueda = (pedidos: string[]) => pedidos.filter((u) => u.includes("/matching/search"));

test("un comercio que entra por URL a /feed va a su panel, sin pedir el feed ni la ubicación", async ({ page }) => {
  const { pedidos, geo } = await setup(page, "employer");
  await page.goto("/feed");
  await expect(page).toHaveURL(/\/shifts$/);
  await page.waitForLoadState("networkidle");
  expect(deFeed(pedidos)).toHaveLength(0);
  expect(await geo()).toBe(0);
});

test("un admin que entra por URL a /feed va a /admin, sin pedir el feed ni la ubicación", async ({ page }) => {
  const { pedidos, geo } = await setup(page, "admin");
  await page.goto("/feed");
  await expect(page).toHaveURL(/\/admin$/);
  await page.waitForLoadState("networkidle");
  expect(deFeed(pedidos)).toHaveLength(0);
  expect(await geo()).toBe(0);
});

test("un trabajador que entra por URL a /search va a su feed, sin buscar trabajadores ni pedir la ubicación", async ({ page }) => {
  const { pedidos, geo } = await setup(page, "worker");
  await page.goto("/search");
  await expect(page).toHaveURL(/\/feed$/);
  await page.waitForLoadState("networkidle");
  expect(deBusqueda(pedidos)).toHaveLength(0);
  // El feed no pide la ubicación al montar: si apareciera, vendría de /search.
  expect(await geo()).toBe(0);
});

test("el trabajador sigue en /feed", async ({ page }) => {
  const { pedidos } = await setup(page, "worker");
  await page.goto("/feed");
  await expect(page).toHaveURL(/\/feed$/);
  await expect.poll(() => deFeed(pedidos).length).toBeGreaterThan(0);
});

for (const role of ["employer", "admin"]) {
  test(`${role} sigue en /search`, async ({ page }) => {
    const busca = page.waitForRequest("**/api/v1/matching/search**");
    await setup(page, role);
    await page.goto("/search");
    await busca;
    await expect(page).toHaveURL(/\/search/);
  });
}

// Con el backend dormido `/auth/me` tarda: mientras el rol no se conoce se ve
// el esqueleto (no una pantalla en blanco), sin pedir datos ni ubicación.
for (const [ruta, role, pedido] of [
  ["/feed", "worker", /\/shifts\/feed/],
  ["/search", "employer", /\/matching\/search/],
] as const) {
  test(`${ruta} con /auth/me demorado muestra el esqueleto y no pide datos hasta saber el rol`, async ({ page }) => {
    const { pedidos, geo } = await setup(page, role, 1500);
    await page.goto(ruta);
    await expect(page.getByTestId("guarda-cargando")).toBeVisible();
    expect(pedidos.filter((u) => pedido.test(u))).toHaveLength(0);
    expect(await geo()).toBe(0);
    await expect(page.getByTestId("guarda-cargando")).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`${ruta}$`));
  });
}
