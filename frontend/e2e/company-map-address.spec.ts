import { test, expect } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * Alta de ubicación desde el mapa (ADR-0006): un employer sin perfil todavía
 * busca la dirección de su local con el geocoder (mockeado — nunca se pega a
 * Nominatim real en CI), elige un resultado, el mapa centra ahí con un pin
 * arrastrable, y el submit manda `address/city/latitude/longitude` con la
 * posición final del pin (fuente de verdad tras el drag).
 */
test("un employer da de alta su local buscando la dirección en el mapa", async ({ page }) => {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);

  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "user-2",
        email: "demo.palermo@staffya.com",
        full_name: "Comercio Demo",
        role: "employer",
        status: "activo",
        is_active: true,
        is_verified: true,
      }),
    })
  );

  // Todavía no tiene perfil de comercio: el form arranca vacío ("Crear perfil").
  await page.route("**/api/v1/companies/me/profile", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Perfil de comercio no encontrado" }),
      });
    }
    return route.continue();
  });

  // Geocoder mockeado (Nominatim) — nunca se pega a la red real en CI. El
  // fetch es cross-origin (localhost:3100 -> nominatim.openstreetmap.org):
  // sin `Access-Control-Allow-Origin` el propio browser bloquea la respuesta
  // mockeada como si fuera un error de CORS, aunque Nominatim real sí lo manda.
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

  await page.goto("/profile/edit");

  await expect(page.getByText("Nombre del comercio")).toBeVisible();

  const searchInput = page.getByPlaceholder("Buscá la dirección de tu local");
  await searchInput.fill("Av. Corrientes 1234");

  // Screenshot 1: la búsqueda con resultados del dropdown.
  await expect(page.getByText("Av. Corrientes 1234, Balvanera, CABA")).toBeVisible();
  await page.screenshot({ path: "/tmp/mapa-01-busqueda-resultados.png" });

  await page.getByText("Av. Corrientes 1234, Balvanera, CABA").click();

  // Al elegir el resultado, el pin queda puesto y los campos de dirección se
  // completan con lo que devolvió el geocoder.
  await expect(page.locator(".maplibregl-marker")).toBeVisible();
  await expect(page.getByPlaceholder("Calle y altura")).toHaveValue(
    "Av. Corrientes 1234, Balvanera, CABA"
  );
  await page.screenshot({ path: "/tmp/mapa-02-pin-puesto.png" });

  // Arrastra el pin: la posición final queda como fuente de verdad de lat/lng.
  const marker = page.locator(".maplibregl-marker");
  const box = await marker.boundingBox();
  if (!box) throw new Error("No se encontró el pin en el mapa");
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 40, startY - 30, { steps: 8 });
  await page.mouse.up();

  await page.screenshot({ path: "/tmp/mapa-03-pin-arrastrado.png" });

  // Completa el nombre (obligatorio) y confirma el alta.
  await page.getByRole("textbox").first().fill("Bar Demo Corrientes");

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
          latitude: -34.6042,
          longitude: -58.3867,
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

  const saveResponse = page.waitForResponse(
    (res) => res.url().includes("/api/v1/companies/me/profile") && res.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Crear perfil" }).click();
  await saveResponse;

  expect(postedBody).not.toBeNull();
  const body = postedBody as unknown as {
    address: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  expect(body.address).toContain("Corrientes");
  expect(body.city).toBeTruthy();
  expect(typeof body.latitude).toBe("number");
  expect(typeof body.longitude).toBe("number");
  await expect(page.getByText("Perfil guardado")).toBeVisible();
});

/**
 * Fallback (ADR-0006): si el geocoder no responde, no se rompe el alta — se
 * ofrece volver al selector manual (`LocationPicker`, provincia/localidad).
 */
test("si el geocoder falla, el employer puede pasar al selector manual", async ({ page }) => {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);

  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "user-2",
        email: "demo.palermo@staffya.com",
        full_name: "Comercio Demo",
        role: "employer",
        status: "activo",
        is_active: true,
        is_verified: true,
      }),
    })
  );

  await page.route("**/api/v1/companies/me/profile", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Perfil de comercio no encontrado" }),
      });
    }
    return route.continue();
  });

  // Geocoder caído: la búsqueda debe mostrar el aviso y ofrecer el fallback.
  await page.route(/nominatim\.openstreetmap\.org\/search/, (route) => route.abort());

  await page.goto("/profile/edit");
  await expect(page.getByText("Nombre del comercio")).toBeVisible();

  await page.getByPlaceholder("Buscá la dirección de tu local").fill("Av. Corrientes 1234");
  await expect(page.getByText("No pudimos conectarnos al buscador de direcciones.")).toBeVisible();

  await page.getByRole("button", { name: "Usar selector manual" }).click();

  // El selector manual (provincia/localidad) queda visible como alternativa.
  await expect(page.locator("select").first()).toBeVisible();
});

/**
 * Elegir un resultado cierra la lista y no dispara una búsqueda nueva (el texto
 * que se completa con la selección no tiene que reabrir el dropdown); escribir
 * después sí vuelve a buscar.
 */
test("elegir un resultado cierra la lista sin buscar de nuevo, y escribir vuelve a buscar", async ({ page }) => {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);

  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "user-2",
        email: "demo.palermo@staffya.com",
        full_name: "Comercio Demo",
        role: "employer",
        status: "activo",
        is_active: true,
        is_verified: true,
      }),
    })
  );

  await page.route("**/api/v1/companies/me/profile", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Perfil de comercio no encontrado" }),
      });
    }
    return route.continue();
  });

  // Cuenta los pedidos al geocoder: cada búsqueda real suma uno.
  let geocoderCalls = 0;
  await page.route(/nominatim\.openstreetmap\.org\/search/, (route) => {
    geocoderCalls += 1;
    return route.fulfill({
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
    });
  });

  await page.goto("/profile/edit");
  await expect(page.getByText("Nombre del comercio")).toBeVisible();

  const searchInput = page.getByPlaceholder("Buscá la dirección de tu local");
  const resultItem = page.getByRole("button", { name: /Av\. Corrientes 1234, Balvanera, CABA/ });

  await searchInput.fill("Av. Corrientes 1234");
  await expect(resultItem).toBeVisible();
  expect(geocoderCalls).toBe(1);

  await resultItem.click();
  await expect(resultItem).toHaveCount(0);

  // Esperamos más que el debounce (400 ms) para que una búsqueda espuria tuviera
  // tiempo de dispararse y reabrir la lista.
  await page.waitForTimeout(1000);
  await expect(resultItem).toHaveCount(0);
  expect(geocoderCalls).toBe(1);

  // Escribir de nuevo sí vuelve a buscar y a mostrar resultados.
  await searchInput.click();
  await searchInput.press("End");
  await searchInput.pressSequentially("x");
  await expect(resultItem).toBeVisible();
  expect(geocoderCalls).toBe(2);
});

/**
 * Caso de carrera: si se escribe un carácter más (queda un debounce pendiente)
 * y se elige un resultado antes de que venza, el timer viejo no tiene que
 * disparar una búsqueda ni reabrir la lista encima del mapa.
 */
test("elegir un resultado con una búsqueda pendiente no reabre la lista", async ({ page }) => {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);

  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "user-2",
        email: "demo.palermo@staffya.com",
        full_name: "Comercio Demo",
        role: "employer",
        status: "activo",
        is_active: true,
        is_verified: true,
      }),
    })
  );

  await page.route("**/api/v1/companies/me/profile", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Perfil de comercio no encontrado" }),
      });
    }
    return route.continue();
  });

  let geocoderCalls = 0;
  await page.route(/nominatim\.openstreetmap\.org\/search/, (route) => {
    geocoderCalls += 1;
    return route.fulfill({
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
    });
  });

  await page.goto("/profile/edit");
  await expect(page.getByText("Nombre del comercio")).toBeVisible();

  const searchInput = page.getByPlaceholder("Buscá la dirección de tu local");
  const resultItem = page.getByRole("button", { name: /Av\. Corrientes 1234, Balvanera, CABA/ });

  await searchInput.fill("Av. Corrientes 12");
  await expect(resultItem).toBeVisible();
  expect(geocoderCalls).toBe(1);

  // Un carácter más deja un debounce pendiente; el resultado se elige enseguida,
  // sin esperar a que venza.
  await searchInput.press("End");
  await searchInput.pressSequentially("3");
  await resultItem.click();
  await expect(resultItem).toHaveCount(0);

  // Esperamos más que el debounce (400 ms) para que el timer viejo tuviera
  // tiempo de disparar.
  // Más que el debounce (400 ms) más la espera entre pedidos del buscador
  // (1100 ms): si el pedido de más volviera, a los 2 s ya habría salido.
  await page.waitForTimeout(2000);
  await expect(resultItem).toHaveCount(0);
  expect(geocoderCalls).toBe(1);
});
