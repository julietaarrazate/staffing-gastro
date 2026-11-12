import { test, expect } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * `/bienvenida` del trabajador cuando el perfil YA existe (la persona vuelve
 * a entrar a la URL del onboarding): el POST da 409 y antes caía a un PUT con
 * un payload corto, que REEMPLAZA el perfil entero y borraba descripción, CV,
 * idiomas y fecha de nacimiento. «Dejar para después» no tiene que escribir
 * nada si el perfil ya está.
 */
test("«Dejar para después» con el perfil ya creado no lo reemplaza", async ({ page }) => {
  await skipSplash(page);
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);

  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "user-1",
        email: "demo@staffya.com",
        full_name: "Mozo Demo",
        role: "worker",
        status: "activo",
        is_active: true,
        is_verified: true,
      }),
    })
  );
  await page.route("**/api/v1/shifts/feed**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/v1/applications/mine", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  const metodos: string[] = [];
  await page.route("**/api/v1/workers/me/profile", (route) => {
    const req = route.request();
    metodos.push(req.method());
    if (req.method() === "POST") {
      return route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ detail: "El perfil de trabajador ya existe" }),
      });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.goto("/bienvenida");
  await page.getByRole("button", { name: /Dejar para después/ }).click();
  await page.waitForURL("**/feed");

  expect(metodos).toContain("POST");
  expect(metodos).not.toContain("PUT");
});
