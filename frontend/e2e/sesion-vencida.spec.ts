import { test, expect, type Page } from "@playwright/test";
import { deContrato, opcionesDeContrato } from "./contrato";
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

// Sesión y respuestas de ingreso reales del backend (e2e/contrato).
const EMPLOYER = deContrato("auth_me_employer");

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});
const NO_AUTORIZADO = opcionesDeContrato("error_401_token_invalido");

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
    return route.fulfill(opcionesDeContrato("login"));
  });

  await page.goto("/shifts?familia=buscando");

  await expect(page).toHaveURL(/\/login\?motivo=vencida&next=%2Fshifts%3Ffamilia%3Dbuscando$/);
  await expect(page.getByRole("status").filter({ hasText: "Tu sesión venció" })).toBeVisible();
  await expect(page.getByText("No autorizado")).toHaveCount(0);
  // Lo dice una sola vez: el ingreso, no además un aviso flotante.
  await expect(page.getByText(/Tu sesión venció/)).toHaveCount(1);

  await page.getByLabel("Email").fill(EMPLOYER.email);
  await page.getByRole("textbox", { name: "Contraseña" }).fill("una-clave-cualquiera");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();

  await expect(page).toHaveURL(/\/shifts\?familia=buscando$/);
});

test("sesión vencida con «Publicar» a medio hacer: al volver a entrar con la misma cuenta el borrador sigue", async ({
  page,
}) => {
  const CLAVE = "staffya:borrador:publicar-turno";
  await base(page);
  // Se deja el borrador una sola vez (una recarga no lo vuelve a poner).
  await page.addInitScript(
    ([clave, owner]) => {
      if (sessionStorage.getItem("_sembrado")) return;
      sessionStorage.setItem("_sembrado", "1");
      sessionStorage.setItem(clave, JSON.stringify({ owner, titulo: "a medias" }));
    },
    [CLAVE, EMPLOYER.id]
  );
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
    return route.fulfill(opcionesDeContrato("login"));
  });

  await page.goto("/shifts?familia=buscando");
  await expect(page).toHaveURL(/\/login\?motivo=vencida/);
  // Vencida la sesión, el borrador de la cuenta sigue en la pestaña.
  expect(await page.evaluate((k) => sessionStorage.getItem(k), CLAVE)).not.toBeNull();

  await page.getByLabel("Email").fill(EMPLOYER.email);
  await page.getByRole("textbox", { name: "Contraseña" }).fill("una-clave-cualquiera");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page).toHaveURL(/\/shifts\?familia=buscando$/);

  expect(await page.evaluate((k) => sessionStorage.getItem(k), CLAVE)).not.toBeNull();
});

test("un `next` que no es una ruta de la app se ignora", async ({ page }) => {
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/**", (route) => route.fulfill(json([])));
  await page.route("**/api/v1/auth/login", (route) =>
    route.fulfill(opcionesDeContrato("login"))
  );
  await page.route("**/api/v1/auth/me", (route) => route.fulfill(json(EMPLOYER)));

  await page.goto("/login?motivo=vencida&next=%2F%2Fexample.com%2Frobo");
  await page.getByLabel("Email").fill(EMPLOYER.email);
  await page.getByRole("textbox", { name: "Contraseña" }).fill("una-clave-cualquiera");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();

  // Sigue a la home del rol, adentro de la app.
  await expect(page).toHaveURL(/localhost:\d+\/shifts$/);
});

test("el ingreso sólo muestra avisos de su lista, no el texto que venga en la dirección", async ({
  page,
}) => {
  await skipSplash(page);
  await blockExternalHosts(page);
  await page.route("**/api/v1/**", (route) => route.fulfill(json([])));

  await page.goto("/login?message=Tu%20cuenta%20fue%20bloqueada%2C%20llam%C3%A1%20al%200800");
  await expect(page.getByRole("heading", { name: "Ingresar" })).toBeVisible();
  await expect(page.getByText(/fue bloqueada/)).toHaveCount(0);

  await page.goto("/login?aviso=cualquier-cosa");
  await expect(page.getByRole("heading", { name: "Ingresar" })).toBeVisible();
  await expect(page.getByText(/cualquier-cosa/)).toHaveCount(0);

  await page.goto("/login?aviso=clave-actualizada");
  await expect(page.getByText("Contraseña actualizada. Ingresá con tu nueva contraseña.")).toBeVisible();
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
  await expect(page.getByText("Error al cargar tus turnos")).toBeVisible();

  awake = true;

  // El primer reintento es a los 2 segundos.
  await expect(header.getByRole("status")).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByRole("navigation").getByRole("link", { name: "Panel" })).toBeVisible();
  // Y el panel se vuelve a pedir solo, sin tocar «Reintentar».
  await expect(page.getByText("Error al cargar tus turnos")).toHaveCount(0, { timeout: 10_000 });
  await expect(page).toHaveURL(/\/shifts$/);
});
