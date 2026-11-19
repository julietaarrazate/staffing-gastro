import { test, expect } from "@playwright/test";
import { blockExternalHosts, mockEmptyNotifications, skipSplash } from "./mocks";
import { deContrato, fulfillContrato } from "./contrato";

/**
 * Un invitado ("Explorar sin cuenta") entra por el mismo onboarding
 * (`/bienvenida`, C4) que vería un usuario recién registrado, en vez de
 * caer directo adentro del panel — así prueba la app desde cero, como
 * cualquier alta nueva. La cuenta invitado es compartida (ver
 * `IdentityService.GUEST_ACCOUNTS`), consistente con que su exploración ya
 * es de por sí compartida entre quien la use.
 */
test("un invitado (comercio) entra por el PIN y cae en el onboarding, no directo al panel", async ({
  page,
}) => {
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);

  await page.route("**/api/v1/auth/guest", (route) =>
    route.request().method() === "GET"
      ? fulfillContrato(route, "acceso_invitado")
      : route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            access_token: "e2e-guest-token",
            user: {
              id: "guest-employer-1",
              email: "invitado.comercio@oido.beta",
              full_name: "Invitado · Comercio",
              role: "employer",
              status: "activo",
              is_active: true,
              is_verified: true,
            },
          }),
        })
  );

  await page.goto("/login");

  await page.getByRole("button", { name: "Soy comercio" }).click();
  await page.getByLabel("PIN de acceso").fill("3526");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL("/bienvenida");
  // getByRole("heading", ...) en vez de getByText(...): Next.js monta su
  // propio anunciador de ruta (`#__next-route-announcer__`, aria-live) con
  // el mismo texto del <h1> mientras dura el anuncio — un getByText sin
  // acotar hace "strict mode violation" (2 elementos) si la asserción cae
  // justo en esa ventana, más frecuente bajo la carga de CI. El heading es
  // el elemento real que le importa al test.
  await expect(page.getByRole("heading", { name: "¿Cómo se llama tu comercio?" })).toBeVisible();
});

test("un invitado (trabajador) entra por el PIN y cae en el onboarding, no directo al feed", async ({
  page,
}) => {
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);

  await page.route("**/api/v1/auth/guest", (route) =>
    route.request().method() === "GET"
      ? fulfillContrato(route, "acceso_invitado")
      : route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            access_token: "e2e-guest-token",
            user: {
              id: "guest-worker-1",
              email: "invitado.trabajador@oido.beta",
              full_name: "Invitado · Trabajador",
              role: "worker",
              status: "activo",
              is_active: true,
              is_verified: true,
            },
          }),
        })
  );

  await page.goto("/login");

  await page.getByRole("button", { name: "Soy trabajador" }).click();
  await page.getByLabel("PIN de acceso").fill("3526");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL("/bienvenida");
  // Mismo motivo que en el test de comercio (ver comentario arriba): el
  // heading, no un getByText sin acotar que también matchea el anunciador
  // de ruta de Next.js.
  await expect(page.getByRole("heading", { name: "¿Dónde querés trabajar?" })).toBeVisible();
});

test("con el acceso de invitado apagado (la beta abierta), el ingreso no muestra «Explorar sin cuenta»", async ({
  page,
}) => {
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  let pedidos = 0;
  await page.route("**/api/v1/auth/guest", (route) => {
    pedidos += 1;
    return route.fulfill({ json: deContrato("acceso_invitado", { enabled: false }) });
  });

  await page.goto("/login");

  await expect(page.getByRole("button", { name: "Ingresar", exact: true })).toBeVisible();
  await expect.poll(() => pedidos).toBe(1);
  await expect(page.getByText("Explorar sin cuenta")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Soy comercio" })).toHaveCount(0);
  await expect(page.getByLabel("PIN de acceso")).toHaveCount(0);
});
