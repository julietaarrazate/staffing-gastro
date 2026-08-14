import { test, expect } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * Onboarding del trabajador: zona, oficio y un tercer paso opcional
 * ("Contanos más" — foto + años de experiencia, pedido de Julieta porque el
 * onboarding quedaba muy breve). Verifica que zona/oficio guarden lo que el
 * feed necesita para no mostrar turnos irrelevantes (ciudad con
 * coordenadas y oficios), y que el tercer paso sea de verdad opcional — se
 * puede terminar sin cargar nada ahí.
 */

const WORKER = {
  id: "user-1",
  email: "nueva@staffya.com",
  full_name: "Trabajadora Nueva",
  role: "worker",
  status: "activo",
  is_active: true,
  is_verified: true,
};

test("el trabajador nuevo elige zona y oficio, y eso se guarda en su perfil", async ({
  page,
}) => {
  await skipSplash(page);
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);

  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(WORKER) })
  );

  // Capturamos el POST del perfil para verificar QUÉ se guarda.
  let savedBody: Record<string, unknown> | null = null;
  await page.route("**/api/v1/workers/me/profile", (route) => {
    if (route.request().method() === "POST") {
      savedBody = route.request().postDataJSON();
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: "p1", ...savedBody }),
      });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.route("**/api/v1/shifts/feed", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/v1/applications/mine", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  await page.goto("/bienvenida");

  // Paso 1: hasta no elegir zona, no se puede continuar.
  const continuar = page.getByRole("button", { name: "Continuar" });
  await expect(continuar).toBeDisabled();

  const selects = page.locator("select");
  await selects.nth(1).selectOption({ index: 1 }); // primer barrio/localidad real
  await expect(continuar).toBeEnabled();
  await continuar.click();

  // Paso 2: hasta no elegir un oficio, no se puede avanzar al paso 3.
  const continuarPaso2 = page.getByRole("button", { name: "Continuar" });
  await expect(continuarPaso2).toBeDisabled();
  await page.getByRole("button", { name: "Mozo/a" }).click();
  await expect(continuarPaso2).toBeEnabled();
  await continuarPaso2.click();

  // Paso 3 ("Contanos más"): opcional de verdad — termina sin cargar nada.
  await expect(page.getByText("Contanos más de vos")).toBeVisible();
  const terminar = page.getByRole("button", { name: "Ver turnos cerca mío" });
  await expect(terminar).toBeEnabled();
  await terminar.click();

  // Termina en el feed, con la zona y el oficio ya guardados.
  await page.waitForURL("**/feed");
  expect(savedBody).not.toBeNull();
  const saved = savedBody as unknown as Record<string, unknown>;
  expect(saved.skills).toEqual(["mozo"]);
  expect(typeof saved.city).toBe("string");
  expect((saved.city as string).length).toBeGreaterThan(0);
  // Coordenadas reales: son las que rankean por distancia en el matching.
  expect(typeof saved.latitude).toBe("number");
  expect(typeof saved.longitude).toBe("number");
  // Paso 3 saltado: foto y experiencia quedan en su default.
  expect(saved.photo_url).toBeNull();
  expect(saved.years_experience).toBe(0);
});

test("el trabajador nuevo puede cargar años de experiencia en el paso opcional", async ({
  page,
}) => {
  await skipSplash(page);
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);

  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(WORKER) })
  );

  let savedBody: Record<string, unknown> | null = null;
  await page.route("**/api/v1/workers/me/profile", (route) => {
    if (route.request().method() === "POST") {
      savedBody = route.request().postDataJSON();
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: "p1", ...savedBody }),
      });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.route("**/api/v1/shifts/feed", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/v1/applications/mine", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  await page.goto("/bienvenida");
  await page.locator("select").nth(1).selectOption({ index: 1 });
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Mozo/a" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.getByLabel("Años de experiencia").fill("5");
  await page.getByRole("button", { name: "Ver turnos cerca mío" }).click();

  await page.waitForURL("**/feed");
  const saved = savedBody as unknown as Record<string, unknown>;
  expect(saved.years_experience).toBe(5);
});

/**
 * Un paso más allá de saltear sólo el paso opcional: poder salir del
 * onboarding completo desde el paso 1, sin zona ni oficio todavía (pedido
 * de Julieta: "que tenga un botón dejar para después por si no quieren
 * llenar en el momento"). No rompe el feed: `skills=[]` y sin ubicación
 * ya se tratan como "sin filtro" del lado del backend.
 */
test("el trabajador puede dejar el onboarding para después desde el paso 1", async ({
  page,
}) => {
  await skipSplash(page);
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);

  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(WORKER) })
  );

  let savedBody: Record<string, unknown> | null = null;
  await page.route("**/api/v1/workers/me/profile", (route) => {
    if (route.request().method() === "POST") {
      savedBody = route.request().postDataJSON();
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: "p1", ...savedBody }),
      });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.route("**/api/v1/shifts/feed", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/v1/applications/mine", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  await page.goto("/bienvenida");
  await page.getByRole("button", { name: "Dejar para después" }).click();

  await page.waitForURL("**/feed");
  expect(savedBody).not.toBeNull();
  const saved = savedBody as unknown as Record<string, unknown>;
  expect(saved.skills).toEqual([]);
  expect(saved.city).toBeNull();
  expect(saved.latitude).toBeNull();
  expect(saved.longitude).toBeNull();
});
