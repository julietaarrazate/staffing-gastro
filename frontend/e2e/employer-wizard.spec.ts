import { test, expect } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * Wizard de publicación de turno (R1.5b): sesión employer, se completa el
 * wizard mínimo (puesto, cantidad fija, horario, pago, ubicación) y se
 * verifica que el POST /shifts sale con quantity=1 en el body.
 */
test("un employer publica un turno con el wizard mínimo", async ({ page }) => {
  await injectSession(page);
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

  await page.route("**/api/v1/shifts", (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: "shift-new-1" }),
      });
    }
    return route.continue();
  });

  await page.route("**/api/v1/shifts/shift-new-1/publish", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  );

  // El wizard redirige a /shifts al terminar: se mockea para que esa
  // pantalla no dependa de la red.
  await page.route("**/api/v1/shifts/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  // Tras publicar, "Ver mi turno" navega a los candidatos del turno recién
  // creado (Fix 2, docs/planning/PULIDO_ROADMAP.md): se mockea para que esa pantalla
  // tampoco dependa de la red.
  await page.route("**/api/v1/applications/shifts/shift-new-1", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/v1/shifts/shift-new-1/candidates", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  await page.goto("/shifts/new");

  // Paso 1: puesto.
  await page.getByRole("button", { name: "Mozo/a" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();

  // Paso 2: cantidad (fija en 1, sólo avanzar).
  await page.getByRole("button", { name: "Continuar" }).click();

  // Paso 3: horario.
  await page.locator('input[type="datetime-local"]').first().fill("2026-07-15T20:00");
  await page.locator('input[type="datetime-local"]').nth(1).fill("2026-07-15T23:00");
  await page.getByRole("button", { name: "Continuar" }).click();

  // Paso 4: pago.
  await page.getByPlaceholder("15000").fill("15000");
  await page.getByRole("button", { name: "Continuar" }).click();

  // Paso 5: ubicación (opcional para publicar, pero la completamos). Los
  // <select> de LocationPicker no tienen label asociado por htmlFor, así que
  // se ubican por posición: 0 = provincia (CABA por defecto), 1 = barrio.
  await page.locator("select").nth(1).selectOption("Palermo");

  const publishRequest = page.waitForRequest(
    (req) =>
      req.url().includes("/api/v1/shifts") &&
      !req.url().includes("/publish") &&
      req.method() === "POST"
  );
  await page.getByRole("button", { name: "Publicar turno" }).click();
  const req = await publishRequest;

  expect(req.postDataJSON().quantity).toBe(1);

  // Fix 2 (docs/planning/PULIDO_ROADMAP.md): en vez de redirigir de una, se muestra
  // la pantalla "esto es lo que sigue" con los 4 próximos pasos del comercio.
  await expect(page.getByText("¡Turno publicado!")).toBeVisible();
  await expect(page.getByText("Ya estamos buscando personal para vos.")).toBeVisible();
  await expect(page.getByText("Recibís candidatos")).toBeVisible();
  await expect(page.getByText("Se califican", { exact: true })).toBeVisible();

  // "Ver mi turno" navega a los candidatos del turno recién publicado.
  await page.getByRole("button", { name: "Ver mi turno" }).click();
  await expect(page).toHaveURL("/shifts/shift-new-1/candidates");
});
