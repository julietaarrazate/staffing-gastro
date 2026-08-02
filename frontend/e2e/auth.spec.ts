import { test, expect } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * Login manual (R1.5b): completa el form de /login, mockea
 * POST /auth/login + GET /auth/me y verifica que la app navega fuera de
 * /login. Tras el login el auth-context hace router.push("/"), y la landing
 * redirige a la home del rol (un worker termina en /feed).
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
  // Un worker logueado no ve la landing: se lo redirige a su home (/feed).
  await expect(page).toHaveURL(/\/feed$/);
});

/**
 * Login persistente (sesión de 30 días): si el access token guardado ya
 * venció pero el refresh token sigue siendo válido, `auth-context` tiene que
 * restaurar la sesión sola (llamando a /auth/refresh) sin mandar a nadie a
 * /login. Antes del fix, si el access token guardado faltaba o el flujo se
 * cortaba antes del refresh, el usuario terminaba teniendo que loguearse de
 * nuevo pese a tener 30 días de refresh disponibles.
 */
test("con el access token vencido pero refresh token válido, la sesión se restaura sola", async ({
  page,
}) => {
  await injectSession(page); // localStorage con access+refresh "viejos"
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);

  let meCalls = 0;
  await page.route("**/api/v1/auth/me", (route) => {
    meCalls += 1;
    if (meCalls === 1) {
      // Primer intento: el access token guardado ya venció.
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Token inválido o expirado" }),
      });
    }
    // Segundo intento: ya con el access token nuevo (post-refresh).
    return route.fulfill({
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
    });
  });

  await page.route("**/api/v1/auth/refresh", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "e2e-refreshed-access-token",
        refresh_token: "e2e-refreshed-refresh-token",
        token_type: "bearer",
      }),
    })
  );

  await page.goto("/");

  // Nunca lo mandamos a /login: la sesión se restauró en silencio y cae en
  // la home de su rol (worker -> /feed).
  await expect(page).toHaveURL(/\/feed$/);
  await expect(page).not.toHaveURL(/\/login$/);
  expect(meCalls).toBeGreaterThanOrEqual(2);
});

/**
 * Cerrar sesión revoca el refresh token server-side (TECH_DEBT.md S1): antes
 * "Cerrar sesión" sólo borraba el localStorage local, el refresh token
 * seguía siendo válido en el backend por sus 30 días completos. El endpoint
 * `POST /auth/logout` ya existía (ADR-0002) pero nunca se llamaba desde acá.
 *
 * `/chats` en vez de `/profile`: superficie mínima (un solo fetch de
 * datos, `GET /chats`) para no depender de mockear todo lo que trae el
 * perfil. El botón "Salir" del Navbar es sólo desktop (`md:inline`), de ahí
 * el viewport ancho.
 */
test("cerrar sesión revoca el refresh token en el backend", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);

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
  await page.route("**/api/v1/chats", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  let logoutBody: unknown = null;
  await page.route("**/api/v1/auth/logout", (route) => {
    logoutBody = route.request().postDataJSON();
    return route.fulfill({ status: 204 });
  });

  await page.goto("/chats");
  await page.getByRole("button", { name: /^Salir/ }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect.poll(() => logoutBody).toEqual({ refresh_token: "e2e-fake-refresh-token" });
});
