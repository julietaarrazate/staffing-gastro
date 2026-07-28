import { test, expect } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * Onboarding del trabajador (zona + oficio). Verifica que los dos pasos
 * guarden lo que el feed necesita para no mostrar turnos irrelevantes: ciudad
 * con coordenadas y oficios. Antes del onboarding, el registro caía en el
 * formulario de perfil completo y esos datos quedaban vacíos.
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

  // Paso 2: hasta no elegir un oficio, no se puede terminar.
  const terminar = page.getByRole("button", { name: "Ver turnos cerca mío" });
  await expect(terminar).toBeDisabled();
  await page.getByRole("button", { name: "Mozo/a" }).click();
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
  // La foto NO se pide en el onboarding (fricción alta); se suma después.
  expect(saved.photo_url).toBeNull();
});
