import { test, expect } from "@playwright/test";
import { blockExternalHosts, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * G10 (U138, U139): el límite de intentos no se dice con mensajes falsos.
 * La forma del 429 es la real de `core/rate_limit.py`: status 429 y
 * `{"detail": "Demasiados intentos. Esperá un momento y volvé a probar."}`.
 */
const RATE_LIMIT_429 = {
  status: 429,
  contentType: "application/json",
  body: JSON.stringify({ detail: "Demasiados intentos. Esperá un momento y volvé a probar." }),
};

test("alta bien hecha con el ingreso automático frenado: va a /login con el aviso, sin error", async ({ page }) => {
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await skipSplash(page);
  let registered = 0;
  await page.route("**/api/v1/auth/register", (route) => {
    registered += 1;
    return route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ id: "u1", email: "nueva@staffya.com", full_name: "Nueva", role: "worker" }),
    });
  });
  await page.route("**/api/v1/auth/login", (route) => route.fulfill(RATE_LIMIT_429));

  await page.goto("/register?next=%2Fturno%2Fabc");
  await page.getByPlaceholder("Nombre completo").fill("Nueva Persona");
  await page.getByPlaceholder("Email").fill("nueva@staffya.com");
  await page.getByPlaceholder("Contraseña (mín. 8 caracteres)").fill("unaClaveLarga1");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  await expect(page).toHaveURL(/\/login\?aviso=cuenta-creada&next=%2Fturno%2Fabc$/);
  await expect(page.getByText("Tu cuenta ya está creada: ingresá en un minuto.")).toBeVisible();
  await expect(page.locator("p[role='alert']")).toHaveCount(0);
  await expect(page.getByText(/Demasiados intentos/)).toHaveCount(0);
  expect(registered).toBe(1);
});

test("ingresar desde /login?aviso=cuenta-creada sigue al next, no a /bienvenida", async ({ page }) => {
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await skipSplash(page);
  await page.route("**/api/v1/auth/login", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ access_token: "e2e-access-token", token_type: "bearer" }),
    }),
  );
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "user-1",
        email: "vieja@staffya.com",
        full_name: "Cuenta Vieja",
        role: "worker",
        status: "activo",
        is_active: true,
        is_verified: true,
      }),
    }),
  );
  await page.route("**/api/v1/workers/me/profile", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/algo", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>algo</body></html>" }),
  );

  await page.goto("/login?aviso=cuenta-creada&next=%2Falgo");
  await expect(page.getByText("Tu cuenta ya está creada: ingresá en un minuto.")).toBeVisible();
  await page.getByPlaceholder("Email").fill("vieja@staffya.com");
  await page.getByPlaceholder("Contraseña").fill("unaClaveLarga1");
  await page.getByRole("button", { name: "Ingresar" }).click();

  await expect(page).toHaveURL(/\/algo$/);
  await expect(page).not.toHaveURL(/bienvenida/);
});

test("si el alta misma falla con 429, sigue mostrando el error y no manda al ingreso", async ({ page }) => {
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await skipSplash(page);
  await page.route("**/api/v1/auth/register", (route) => route.fulfill(RATE_LIMIT_429));

  await page.goto("/register");
  await page.getByPlaceholder("Nombre completo").fill("Nueva Persona");
  await page.getByPlaceholder("Email").fill("nueva@staffya.com");
  await page.getByPlaceholder("Contraseña (mín. 8 caracteres)").fill("unaClaveLarga1");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  await expect(page.locator("p[role='alert']")).toContainText("Demasiados intentos");
  await expect(page).toHaveURL(/\/register$/);
});

test("/recuperar con 429 dice «Demasiados intentos, esperá un minuto» y deja reintentar", async ({ page }) => {
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await skipSplash(page);
  await page.route("**/api/v1/auth/forgot-password", (route) => route.fulfill(RATE_LIMIT_429));

  await page.goto("/recuperar");
  await page.getByPlaceholder("Email").fill("alguien@staffya.com");
  await page.getByRole("button", { name: "Enviar enlace" }).click();

  await expect(page.locator("p[role='alert']")).toHaveText("Demasiados intentos, esperá un minuto.");
  await expect(page.getByText(/Si el mail existe/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Enviar enlace" })).toBeVisible();
});

test("/recuperar con otro error sigue sin revelar nada", async ({ page }) => {
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await skipSplash(page);
  await page.route("**/api/v1/auth/forgot-password", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ detail: "x" }) })
  );

  await page.goto("/recuperar");
  await page.getByPlaceholder("Email").fill("alguien@staffya.com");
  await page.getByRole("button", { name: "Enviar enlace" }).click();

  await expect(page.getByText("Si el mail existe, te enviamos un enlace")).toBeVisible();
  await expect(page.locator("p[role='alert']")).toHaveCount(0);
});

test("/verificar-email: 429 al confirmar y al reenviar dice «Demasiados intentos»", async ({ page }) => {
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await skipSplash(page);
  await page.route("**/api/v1/auth/verify-email", (route) => route.fulfill(RATE_LIMIT_429));
  await page.route("**/api/v1/auth/resend-verification", (route) => route.fulfill(RATE_LIMIT_429));

  await page.goto("/verificar-email?token=abc");
  await expect(page.locator("p[role='alert']")).toHaveText("Demasiados intentos, esperá un minuto.");

  await page.getByPlaceholder("Email").fill("alguien@staffya.com");
  await page.getByRole("button", { name: "Reenviar enlace" }).click();
  await expect(page.locator("p[role='alert']")).toHaveText("Demasiados intentos, esperá un minuto.");
  await expect(page.getByText(/Si el email existe/)).toHaveCount(0);
});

test("/verificar-email: un enlace vencido (400) sigue diciendo que venció", async ({ page }) => {
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await skipSplash(page);
  await page.route("**/api/v1/auth/verify-email", (route) =>
    route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ detail: "Token inválido" }) })
  );
  await page.goto("/verificar-email?token=abc");
  await expect(page.getByText("El enlace es inválido o venció.")).toBeVisible();
});
