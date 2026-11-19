import { test, expect, type Page } from "@playwright/test";
import { deContrato, fulfillContrato } from "./contrato";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * Errores de validación que se entienden (G8, U030/U031): un 422 de Pydantic
 * (lista `[{type, loc, msg, ctx}]`) se muestra en castellano, nunca como
 * «Error inesperado» ni con el mensaje en inglés. Los cuerpos y los status son
 * los que devuelve el backend (`e2e/contrato`), no escritos a mano.
 */

const json = (status: number, body: unknown) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

test("registro con un mail sin dominio dice que tiene que ser un mail válido", async ({ page }) => {
  await skipSplash(page);
  await blockExternalHosts(page);
  await page.route("**/api/v1/**", (route) => route.fulfill(json(401, {})));
  await page.route("**/api/v1/auth/register", (route) =>
    fulfillContrato(route, "registro_mail_invalido")
  );
  await page.goto("/register");

  // Los campos llevan los mismos límites que el servidor.
  await expect(page.getByPlaceholder("Nombre completo")).toHaveAttribute("maxlength", "255");
  await expect(page.getByPlaceholder("Contraseña (mín. 8 caracteres)")).toHaveAttribute("maxlength", "128");

  await page.getByPlaceholder("Nombre completo").fill("Lucía Gómez");

  await page.getByLabel("Fecha de nacimiento").fill("1995-05-20");
  await page.getByPlaceholder("Email").fill("lucia@bar");
  await page.getByPlaceholder("Contraseña (mín. 8 caracteres)").fill("clave-larga-123");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Crear cuenta" }).last().click();

  await expect(page.getByText("Mail: tiene que ser un mail válido")).toBeVisible();
  await expect(page.getByText("Error inesperado")).toHaveCount(0);
  await expect(page.getByText(/valid email address/)).toHaveCount(0);
});

async function setupChat(page: Page) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await page.route("**/api/v1/**", (route) =>
    route.request().method() === "GET" ? route.fulfill(json(200, [])) : route.continue()
  );
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) => fulfillContrato(route, "auth_me_worker"));
}

// El turno confirmado del trabajador, tal como lo manda el backend; `id` y
// `status` ya son los de la URL que usan los tests.
const shift = deContrato("turno_confirmado_trabajador", { id: "shift-1" });

test("chat: el mensaje demasiado largo se explica en castellano y el campo ya trae el límite", async ({ page }) => {
  await setupChat(page);
  await page.route("**/api/v1/shifts/shift-1", (route) => route.fulfill(json(200, shift)));
  await page.route("**/api/v1/chats/shift-1/messages", (route) =>
    route.request().method() === "POST"
      ? fulfillContrato(route, "chat_mensaje_largo")
      : route.fulfill(json(200, []))
  );
  await page.goto("/chats/shift-1");

  const campo = page.getByPlaceholder("Escribí un mensaje...");
  await expect(campo).toHaveAttribute("maxlength", "2000");
  await campo.fill("Hola");
  await page.getByRole("button", { name: "Enviar" }).click();

  await expect(page.getByText("Mensaje: máximo 2000 caracteres")).toBeVisible();
  await expect(page.getByText("Error inesperado")).toHaveCount(0);
  await expect(page.getByText(/at most 2000/)).toHaveCount(0);
});

test("«Llegué» que el servidor rechaza avisa con un aviso flotante, no con un banner arriba", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: -34.58, longitude: -58.43 });
  await setupChat(page);
  await page.route("**/api/v1/shifts/mine", (route) => route.fulfill(json(200, [{ ...shift, start_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() }]))
  );
  await page.route("**/api/v1/shifts/shift-1/check-in", (route) =>
    fulfillContrato(route, "turno_llegada_antes_de_tiempo") // 400, no 409: el backend usa 400 para esto
  
  );
  await page.goto("/my-shifts");
  await page.getByRole("button", { name: "Llegué" }).click();

  await expect(page.getByText(/Todavía no podés marcar tu llegada/)).toBeVisible();
  // Es un aviso flotante (no el banner con «Reintentar» de arriba de la lista).
  await expect(page.getByRole("button", { name: "Reintentar" })).toHaveCount(0);
});
