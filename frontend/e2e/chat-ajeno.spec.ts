import { test, expect } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * U099: el chat de un turno ajeno (o inexistente) dice «no encontrada» y NO
 * deja escribir: sin formulario de envío.
 */
test("un chat que no existe o no es mío no muestra el formulario de envío", async ({ page }) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "user-1",
        email: "w@staffya.com",
        full_name: "Worker",
        role: "worker",
        status: "activo",
        is_active: true,
        is_verified: true,
      }),
    })
  );
  await page.route("**/api/v1/chats", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/v1/chats/ajeno/messages", (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Conversación no encontrada" }),
    })
  );
  await page.route("**/api/v1/shifts/ajeno", (route) =>
    route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "x" }) })
  );

  await page.goto("/chats/ajeno");
  await expect(page.getByText("Conversación no encontrada")).toBeVisible();
  await expect(page.getByPlaceholder("Escribí un mensaje...")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Enviar" })).toHaveCount(0);
});

test("un error de red al cargar el chat no oculta el formulario (sólo el 404 lo hace)", async ({ page }) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "user-1",
        email: "w@staffya.com",
        full_name: "Worker",
        role: "worker",
        status: "activo",
        is_active: true,
        is_verified: true,
      }),
    })
  );
  await page.route("**/api/v1/chats", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/v1/chats/mio/messages", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ detail: "x" }) })
  );
  await page.route("**/api/v1/shifts/mio", (route) =>
    route.fulfill({ status: 404, contentType: "application/json", body: "{}" })
  );
  await page.goto("/chats/mio");
  await expect(page.getByRole("button", { name: "Reintentar" }).first()).toBeVisible();
  await expect(page.getByPlaceholder("Escribí un mensaje...")).toBeVisible();
});
