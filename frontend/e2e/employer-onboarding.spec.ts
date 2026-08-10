import { test, expect } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * Onboarding del comercio recién registrado (auditoría de producto
 * 2026-08-10, C4): nombre + ubicación en `/bienvenida`, que antes sólo
 * atendía al trabajador (el comercio caía directo en `/shifts` sin haber
 * cargado nada). Verifica el POST a /companies/me/profile y que termina
 * llevando a publicar el primer turno, no a un panel vacío.
 */
test("un comercio nuevo carga nombre y ubicación, y termina publicando su primer turno", async ({
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

  await page.goto("/bienvenida");

  // Paso 1: hasta no poner nombre, no se puede continuar.
  const continuar = page.getByRole("button", { name: "Continuar" });
  await expect(continuar).toBeDisabled();
  await page.getByLabel("Nombre del comercio").fill("Bar Demo Corrientes");
  await expect(continuar).toBeEnabled();
  await continuar.click();

  // Paso 2: hasta no elegir una ubicación, no se puede terminar.
  const publicar = page.getByRole("button", { name: "Publicar mi primer turno" });
  await expect(publicar).toBeDisabled();

  const searchInput = page.getByPlaceholder("Buscá la dirección de tu local");
  await searchInput.fill("Av. Corrientes 1234");
  await expect(page.getByText("Av. Corrientes 1234, Balvanera, CABA")).toBeVisible();
  await page.getByText("Av. Corrientes 1234, Balvanera, CABA").click();

  await expect(publicar).toBeEnabled();
  await publicar.click();

  // Termina en el wizard de publicar turno, con nombre y ubicación ya guardados.
  await page.waitForURL("**/shifts/new");
  await expect(page.getByText("¿Qué necesitás?")).toBeVisible();

  expect(postedBody).not.toBeNull();
  const saved = postedBody as unknown as Record<string, unknown>;
  expect(saved.name).toBe("Bar Demo Corrientes");
  expect(typeof saved.latitude).toBe("number");
  expect(typeof saved.longitude).toBe("number");
  // El logo NO se pide de forma obligatoria (fricción alta); se suma después.
  expect(saved.logo_url).toBeNull();
});
