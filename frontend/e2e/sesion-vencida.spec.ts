import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * G7 de la salida a beta (U112, U096, U114): la app siempre sabe si hay
 * sesión.
 *
 * - Con la sesión vencida, una pantalla protegida mostraba «No autorizado» y
 *   se quedaba ahí. Ahora lleva al ingreso, que dice por qué, y al ingresar
 *   vuelve a donde estaba la persona.
 * - Con el servidor dormido al abrir la app, la cabecera caía a la de
 *   visitante («Ingresar», «Crear cuenta») con la sesión intacta. Ahora dice
 *   «Reconectando…» y se recupera sola.
 */

const EMPLOYER = {
  id: "user-1",
  email: "demo.comercio@staffya.com",
  full_name: "Comercio Demo",
  role: "employer",
  status: "activo",
  is_active: true,
  is_verified: true,
};

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});
const NO_AUTORIZADO = json({ detail: "No autorizado" }, 401);

async function base(page: Page) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  // Lo que no se mockea abajo responde vacío: ningún pedido sale a internet.
  await page.route("**/api/v1/**", (route) => route.fulfill(json([])));
}

test("sesión vencida: lleva al ingreso con el motivo y, al ingresar, vuelve a la pantalla", async ({
  page,
}) => {
  await base(page);
  let sessionAlive = false;
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill(sessionAlive ? json(EMPLOYER) : NO_AUTORIZADO)
  );
  await page.route("**/api/v1/auth/refresh", (route) => route.fulfill(NO_AUTORIZADO));
  await page.route("**/api/v1/shifts/me**", (route) =>
    route.fulfill(sessionAlive ? json([]) : NO_AUTORIZADO)
  );
  await page.route("**/api/v1/auth/login", (route) => {
    sessionAlive = true;
    return route.fulfill(json({ access_token: "token-nuevo", user: EMPLOYER }));
  });

  await page.goto("/shifts?familia=buscando");

  await expect(page).toHaveURL(/\/login\?motivo=vencida&next=%2Fshifts%3Ffamilia%3Dbuscando$/);
  await expect(page.getByRole("status").filter({ hasText: "Tu sesión venció" })).toBeVisible();
  await expect(page.getByText("No autorizado")).toHaveCount(0);

  await page.getByLabel("Email").fill(EMPLOYER.email);
  await page.getByRole("textbox", { name: "Contraseña" }).fill("una-clave-cualquiera");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();

  await expect(page).toHaveURL(/\/shifts\?familia=buscando$/);
});

test("un `next` que no es una ruta de la app se ignora", async ({ page }) => {
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/**", (route) => route.fulfill(json([])));
  await page.route("**/api/v1/auth/login", (route) =>
    route.fulfill(json({ access_token: "token-nuevo", user: EMPLOYER }))
  );
  await page.route("**/api/v1/auth/me", (route) => route.fulfill(json(EMPLOYER)));

  await page.goto("/login?motivo=vencida&next=%2F%2Fexample.com%2Frobo");
  await page.getByLabel("Email").fill(EMPLOYER.email);
  await page.getByRole("textbox", { name: "Contraseña" }).fill("una-clave-cualquiera");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();

  // Sigue a la home del rol, adentro de la app.
  await expect(page).toHaveURL(/localhost:\d+\/shifts$/);
});

test("servidor dormido al abrir: «Reconectando…», sin cabecera de visitante, y se recupera sola", async ({
  page,
}) => {
  await base(page);
  let awake = false;
  await page.route("**/api/v1/auth/me", (route) =>
    awake ? route.fulfill(json(EMPLOYER)) : route.abort("connectionrefused")
  );
  await page.route("**/api/v1/shifts/me**", (route) =>
    awake ? route.fulfill(json([])) : route.abort("connectionrefused")
  );

  await page.goto("/shifts");

  const header = page.getByRole("banner");
  await expect(header.getByRole("status")).toHaveText("Reconectando…");
  await expect(header.getByRole("link", { name: "Ingresar" })).toHaveCount(0);
  await expect(header.getByRole("link", { name: "Crear cuenta" })).toHaveCount(0);
  // Nadie la mandó al ingreso: la sesión sigue guardada.
  await expect(page).toHaveURL(/\/shifts$/);

  awake = true;

  // El primer reintento es a los 2 segundos.
  await expect(header.getByRole("status")).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByRole("navigation").getByRole("link", { name: "Panel" })).toBeVisible();
  await expect(page).toHaveURL(/\/shifts$/);
});
