import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * G16 de la salida a beta (U062): quien llega por un link y tiene que
 * ingresar o registrarse vuelve a donde iba. `next` viaja por `/login`,
 * `/register`, `/bienvenida` y los links entre ellos, y se valida con
 * `lib/safe-next.ts` en cada lugar donde se usa para navegar.
 *
 * `/turno/[id]` lo arma el servidor (no se puede mockear con `page.route`),
 * así que acá se prueba el recorrido hasta llegar a esa dirección; el link de
 * «Postulate en Oído» con su `next` lo cubre `ShiftDetail.test.tsx`.
 */

const TURNO = "/turno/6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f";

const WORKER = {
  id: "user-7",
  email: "nueva@staffya.com",
  full_name: "Trabajadora Nueva",
  role: "worker",
  status: "activo",
  is_active: true,
  is_verified: true,
};

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

async function sinSesion(page: Page) {
  await skipSplash(page);
  await blockExternalHosts(page);
  // Catch-all primero: Playwright resuelve las rutas al revés (gana la última).
  await page.route("**/api/v1/**", (route) => route.fulfill(json([])));
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/register", (route) => route.fulfill(json(WORKER, 201)));
  await page.route("**/api/v1/auth/login", (route) =>
    route.fulfill(json({ access_token: "e2e-access-token", token_type: "bearer" }))
  );
  await page.route("**/api/v1/auth/me", (route) => route.fulfill(json(WORKER)));
  await page.route("**/api/v1/workers/me/profile", (route) =>
    route.request().method() === "POST"
      ? route.fulfill(json({ id: "p1" }, 201))
      : route.fulfill(json({}, 404))
  );
  await page.route("**/api/v1/shifts/feed", (route) => route.fulfill(json([])));
  await page.route("**/api/v1/applications/mine", (route) => route.fulfill(json([])));
}

async function completarAlta(page: Page) {
  await page.getByPlaceholder("Nombre completo").fill("Trabajadora Nueva");
  await page.getByPlaceholder("Email").fill("nueva@staffya.com");
  await page.getByPlaceholder("Contraseña (mín. 8 caracteres)").fill("unaClaveLarga1");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Crear cuenta" }).click();
}

test("registrarse desde un link de turno: alta, bienvenida y termina en el turno", async ({ page }) => {
  await sinSesion(page);

  await page.goto(`/register?rol=trabajador&next=${encodeURIComponent(TURNO)}`);
  await completarAlta(page);

  // La bienvenida lleva la vuelta en la dirección.
  await page.waitForURL(/\/bienvenida\?next=%2Fturno%2F6f1c2d3e/);
  await page.getByRole("button", { name: "Dejar para después" }).click();

  await page.waitForURL(`**${TURNO}`);
});

test("ingresar desde un link de turno vuelve al turno, y los links del ingreso llevan la vuelta", async ({
  page,
}) => {
  await sinSesion(page);

  await page.goto(`/login?next=${encodeURIComponent(TURNO)}`);
  const alta = page.getByRole("link", { name: "Creá una" });
  await expect(alta).toHaveAttribute("href", `/register?next=${encodeURIComponent(TURNO)}`);
  // La cabecera hace lo mismo: «Crear cuenta» lleva la vuelta.
  await expect(page.getByRole("link", { name: "Crear cuenta" })).toHaveAttribute(
    "href",
    `/register?next=${encodeURIComponent(TURNO)}`
  );

  await page.getByLabel("Email").fill("nueva@staffya.com");
  await page.getByRole("textbox", { name: "Contraseña" }).fill("unaClaveLarga1");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await page.waitForURL(`**${TURNO}`);
});

test("el alta devuelve al ingreso con la misma vuelta", async ({ page }) => {
  await sinSesion(page);

  await page.goto(`/register?next=${encodeURIComponent(TURNO)}`);
  await expect(page.getByRole("link", { name: "Ingresá", exact: true }).first()).toHaveAttribute(
    "href",
    `/login?next=${encodeURIComponent(TURNO)}`
  );
});

test("un `next` externo se ignora en el alta, en el ingreso y en la bienvenida", async ({ page }) => {
  await sinSesion(page);

  for (const malo of ["https://otro.sitio/robo", "//otro.sitio", "/\\otro.sitio", "javascript:alert(1)"]) {
    // Alta: ni el link al ingreso ni la bienvenida lo llevan.
    await page.goto(`/register?rol=trabajador&next=${encodeURIComponent(malo)}`);
    await expect(page.getByRole("link", { name: "Ingresá", exact: true }).first()).toHaveAttribute(
      "href",
      "/login"
    );
    await completarAlta(page);
    await page.waitForURL(/\/bienvenida$/);
    await page.getByRole("button", { name: "Dejar para después" }).click();
    await page.waitForURL("**/feed");
    expect(new URL(page.url()).hostname).toBe("localhost");
  }

  // Bienvenida con un `next` externo puesto a mano: va al feed igual.
  await page.goto(`/bienvenida?next=${encodeURIComponent("https://otro.sitio/robo")}`);
  await page.getByRole("button", { name: "Dejar para después" }).click();
  await page.waitForURL("**/feed");
  expect(new URL(page.url()).hostname).toBe("localhost");

  // Ingreso con un `next` externo: la home, no el otro sitio.
  await page.goto(`/login?next=${encodeURIComponent("//otro.sitio")}`);
  await expect(page.getByRole("link", { name: "Creá una" })).toHaveAttribute("href", "/register");
});
