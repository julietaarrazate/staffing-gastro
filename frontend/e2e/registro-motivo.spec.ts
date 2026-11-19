import { test, expect } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/** U041: el botón de /register dice qué falta, en vez de quedar gris mudo. */
test("el botón de crear cuenta explica qué falta", async ({ page }) => {
  await blockExternalHosts(page);
  await skipSplash(page);
  await page.goto("/register");
  const motivo = page.getByTestId("motivo-crear-cuenta");
  const boton = page.getByRole("button", { name: "Crear cuenta" });

  await expect(motivo).toHaveText("Escribí tu nombre para seguir.");
  await page.getByPlaceholder("Nombre completo").fill("   ");
  await expect(motivo).toHaveText("Escribí tu nombre para seguir.");
  await expect(boton).toBeDisabled();

  await page.getByPlaceholder("Nombre completo").fill("Ana Pérez");
  await expect(motivo).toHaveText("Escribí tu fecha de nacimiento para seguir.");
  // U101: un menor de 18 no puede crear la cuenta; el campo lo dice.
  await page.getByLabel("Fecha de nacimiento").fill("2012-03-01");
  await expect(motivo).toHaveText("Oído es sólo para mayores de 18 años.");
  await expect(page.getByRole("alert").filter({ hasText: "mayores de 18" })).toBeVisible();
  await page.getByLabel("Fecha de nacimiento").fill("1995-05-20");
  await page.getByPlaceholder("Email").fill("ana@staffya.com");
  await page.getByPlaceholder("Contraseña (mín. 8 caracteres)").fill("aaaaaaaa");
  await expect(motivo).toContainText("un solo carácter repetido");

  await page.getByPlaceholder("Contraseña (mín. 8 caracteres)").fill("unaClaveLarga1");
  await expect(motivo).toContainText("Aceptá los términos");
  await page.getByRole("checkbox").check();
  await expect(motivo).toHaveCount(0);
  await expect(boton).toBeEnabled();
});

/** U042: con sesión, «Ingresar» de /verificar-email lleva al inicio del rol. */
test("con sesión, tras confirmar el mail el botón lleva al inicio del rol", async ({ page }) => {
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await injectSession(page);
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "u1",
        email: "ana@staffya.com",
        full_name: "Ana",
        role: "worker",
        is_verified: false,
        created_at: "2026-11-01T00:00:00Z",
      }),
    })
  );
  await page.route("**/api/v1/auth/verify-email", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  );
  await page.goto("/verificar-email?token=abc");
  const ir = page.getByRole("link", { name: "Ir al inicio" });
  await expect(ir).toBeVisible();
  await expect(ir).toHaveAttribute("href", "/feed");
});

test("sin sesión, el botón sigue siendo Ingresar y va a /login", async ({ page }) => {
  await blockExternalHosts(page);
  await skipSplash(page);
  await page.route("**/api/v1/auth/verify-email", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  );
  await page.goto("/verificar-email?token=abc");
  const boton = page.getByRole("button", { name: "Ingresar", exact: true });
  await expect(boton).toBeVisible();
  await expect(page.locator("a[href='/login']").filter({ has: boton })).toHaveCount(1);
});
