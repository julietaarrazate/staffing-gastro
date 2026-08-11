import { test, expect } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * Onboarding del comercio recién registrado (auditoría de producto
 * 2026-08-10, C4): nombre + ubicación en `/bienvenida`, que antes sólo
 * atendía al trabajador (el comercio caía directo en `/shifts` sin haber
 * cargado nada). Verifica el POST a /companies/me/profile y que termina en
 * el panel (`/shifts`), no empujado a publicar un turno sin pensarlo
 * (corregido 2026-08-11, ver docstring de bienvenida/page.tsx).
 */
test("un comercio nuevo carga nombre y ubicación, y termina en su panel", async ({
  page,
}) => {
  await skipSplash(page);
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);

  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "user-2",
        email: "nuevo.comercio@staffya.com",
        full_name: "Dueño Nuevo",
        role: "employer",
        status: "activo",
        is_active: true,
        is_verified: true,
      }),
    })
  );

  await page.route(/nominatim\.openstreetmap\.org\/search/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify([
        {
          display_name: "Av. Corrientes 1234, Balvanera, CABA, Argentina",
          lat: "-34.6045",
          lon: "-58.3872",
          address: { suburb: "Balvanera", city: "CABA" },
        },
      ]),
    })
  );

  let postedBody: Record<string, unknown> | null = null;
  await page.route("**/api/v1/companies/me/profile", (route) => {
    if (route.request().method() === "POST") {
      postedBody = route.request().postDataJSON();
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "company-1",
          user_id: "user-2",
          name: "Bar Demo Corrientes",
          logo_url: null,
          category: null,
          description: null,
          address: "Av. Corrientes 1234, Balvanera, CABA",
          city: "CABA",
          latitude: -34.6045,
          longitude: -58.3872,
          capacity: null,
          opening_hours: null,
          rating: 0,
          events_published: 0,
          on_time_payment_rate: 0,
        }),
      });
    }
    return route.continue();
  });
  await page.route("**/api/v1/shifts/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  await page.goto("/bienvenida");

  // Paso 1: hasta no poner nombre, no se puede continuar.
  const continuar = page.getByRole("button", { name: "Continuar" });
  await expect(continuar).toBeDisabled();
  await page.getByLabel("Nombre del comercio").fill("Bar Demo Corrientes");
  await expect(continuar).toBeEnabled();
  await continuar.click();

  // Paso 2: hasta no elegir una ubicación, no se puede terminar.
  const terminar = page.getByRole("button", { name: "Terminar" });
  await expect(terminar).toBeDisabled();

  const searchInput = page.getByPlaceholder("Buscá la dirección de tu local");
  await searchInput.fill("Av. Corrientes 1234");
  await expect(page.getByText("Av. Corrientes 1234, Balvanera, CABA")).toBeVisible();
  await page.getByText("Av. Corrientes 1234, Balvanera, CABA").click();

  await expect(terminar).toBeEnabled();
  await terminar.click();

  // Termina en el panel, no empujado directo a publicar un turno.
  await page.waitForURL("**/shifts");
  await expect(page.getByRole("heading", { name: "Panel" })).toBeVisible();

  expect(postedBody).not.toBeNull();
  const saved = postedBody as unknown as Record<string, unknown>;
  expect(saved.name).toBe("Bar Demo Corrientes");
  expect(typeof saved.latitude).toBe("number");
  expect(typeof saved.longitude).toBe("number");
  // El logo NO se pide de forma obligatoria (fricción alta); se suma después.
  expect(saved.logo_url).toBeNull();
});

/**
 * Antes no había salida real del onboarding si no se quería cargar la
 * ubicación ya mismo: "Volver" sólo daba vueltas entre los 2 pasos.
 */
test("el comercio puede omitir la ubicación y cargarla después", async ({ page }) => {
  await skipSplash(page);
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);

  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "user-3",
        email: "otro.comercio@staffya.com",
        full_name: "Otra Dueña",
        role: "employer",
        status: "activo",
        is_active: true,
        is_verified: true,
      }),
    })
  );
  await page.route("**/api/v1/shifts/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  let postedBody: Record<string, unknown> | null = null;
  await page.route("**/api/v1/companies/me/profile", (route) => {
    if (route.request().method() === "POST") {
      postedBody = route.request().postDataJSON();
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "company-2",
          user_id: "user-3",
          name: "Café Demo",
          logo_url: null,
          category: null,
          description: null,
          address: null,
          city: null,
          latitude: null,
          longitude: null,
          capacity: null,
          opening_hours: null,
          rating: 0,
          events_published: 0,
          on_time_payment_rate: 0,
        }),
      });
    }
    return route.continue();
  });

  await page.goto("/bienvenida");
  await page.getByLabel("Nombre del comercio").fill("Café Demo");
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.getByRole("button", { name: "Cargar la ubicación después" }).click();
  await page.waitForURL("**/shifts");

  expect(postedBody).not.toBeNull();
  const saved = postedBody as unknown as Record<string, unknown>;
  expect(saved.name).toBe("Café Demo");
  expect(saved.latitude).toBeNull();
  expect(saved.longitude).toBeNull();
});
