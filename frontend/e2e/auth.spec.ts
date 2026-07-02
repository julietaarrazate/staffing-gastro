import { test, expect } from "@playwright/test";
import { blockExternalHosts, mockEmptyNotifications } from "./mocks";

/**
 * Login manual (R1.5b): completa el form de /login, mockea
 * POST /auth/login + GET /auth/me y verifica que la app navega fuera de
 * /login (auth-context hace router.push("/") tras un login exitoso).
 */
test("un worker puede loguearse y sale de /login", async ({ page }) => {
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);

  await page.route("**/api/v1/auth/login", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "e2e-access-token",
        refresh_token: "e2e-refresh-token",
        token_type: "bearer",
      }),
    })
  );

  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "user-1",
        email: "demo.mozo.palermo@staffya.com",
        full_name: "Mozo Demo",
        role: "worker",
        status: "activo",
        is_active: true,
        is_verified: true,
      }),
    })
  );

  await page.goto("/login");

  await page.getByPlaceholder("Email").fill("demo.mozo.palermo@staffya.com");
  await page.getByPlaceholder("Contraseña").fill("staffyaDemo123");
  await page.getByRole("button", { name: "Ingresar" }).click();

  await expect(page).not.toHaveURL(/\/login$/);
  await expect(page).toHaveURL("/");
});
