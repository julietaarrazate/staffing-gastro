import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * Errores de validación que se entienden (G8, U030/U031): un 422 de Pydantic
 * (lista `[{type, loc, msg, ctx}]`) se muestra en castellano, nunca como
 * «Error inesperado» ni con el mensaje en inglés. Los cuerpos son la forma
 * exacta que devuelve el backend.
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
    route.fulfill(
      json(422, {
        detail: [
          {
            type: "value_error",
            loc: ["body", "email"],
            msg: "value is not a valid email address: The part after the @-sign is not valid. It should have a period.",
            ctx: { reason: "The part after the @-sign is not valid. It should have a period." },
          },
        ],
      })
    )
  );
  await page.goto("/register");

  // Los campos llevan los mismos límites que el servidor.
  await expect(page.getByPlaceholder("Nombre completo")).toHaveAttribute("maxlength", "255");
  await expect(page.getByPlaceholder("Contraseña (mín. 8 caracteres)")).toHaveAttribute("maxlength", "128");

  await page.getByPlaceholder("Nombre completo").fill("Lucía Gómez");
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
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill(
      json(200, {
        id: "u1",
        email: "u@oido.test",
        full_name: "Juan Pérez",
        role: "worker",
        status: "activo",
        is_active: true,
        is_verified: true,
      })
    )
  );
}

const shift = {
  id: "s1",
  company_id: "c1",
  position: "mozo",
  quantity: 1,
  start_at: "2030-07-20T20:00:00-03:00",
  end_at: "2030-07-21T02:00:00-03:00",
  pay_amount: "148000",
  currency: "ARS",
  tips: false,
  meal: false,
  dress_code: null,
  urgent: false,
  address: null,
  city: "Palermo, CABA",
  latitude: null,
  longitude: null,
  title: null,
  description: null,
  status: "confirmado",
  worker_profile_id: "wp1",
  worker_name: "Juan Pérez",
  created_at: "2030-07-01T12:00:00-03:00",
  company_name: "Bar La Esquina",
  company_logo_url: null,
};

test("chat: el mensaje demasiado largo se explica en castellano y el campo ya trae el límite", async ({ page }) => {
  await setupChat(page);
  await page.route("**/api/v1/shifts/s1", (route) => route.fulfill(json(200, shift)));
  await page.route("**/api/v1/chats/s1/messages", (route) =>
    route.request().method() === "POST"
      ? route.fulfill(
          json(422, {
            detail: [
              {
                type: "string_too_long",
                loc: ["body", "body"],
                msg: "String should have at most 2000 characters",
                ctx: { max_length: 2000 },
              },
            ],
          })
        )
      : route.fulfill(json(200, []))
  );
  await page.goto("/chats/s1");

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
  await page.route("**/api/v1/shifts/mine", (route) => route.fulfill(json(200, [shift])));
  await page.route("**/api/v1/shifts/s1/check-in", (route) =>
    route.fulfill(json(409, { detail: "Todavía falta para marcar tu llegada" }))
  );
  await page.goto("/my-shifts");
  await page.getByRole("button", { name: "Llegué" }).click();

  await expect(page.getByText("Todavía falta para marcar tu llegada")).toBeVisible();
  // Es un aviso flotante (no el banner con «Reintentar» de arriba de la lista).
  await expect(page.getByRole("button", { name: "Reintentar" })).toHaveCount(0);
});
