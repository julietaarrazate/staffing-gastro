import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * C.1 (auditoría de producto 2026-08-10): soporte usuario ↔ Oído, hoy
 * inexistente — la política de privacidad ya prometía un canal que no
 * existía. Cubre el flujo mínimo: el trabajador abre un ticket y lo ve en
 * su lista, y el admin lo lista y responde (mock, sin backend real en CI).
 */

const WORKER_SESSION = {
  id: "user-1",
  email: "worker.support@staffya.com",
  full_name: "Trabajadora Soporte",
  role: "worker",
  status: "activo",
  is_active: true,
  is_verified: true,
};

const ADMIN_SESSION = {
  id: "user-9",
  email: "admin.support@staffya.com",
  full_name: "Admin",
  role: "admin",
  status: "activo",
  is_active: true,
  is_verified: true,
};

const TICKET = {
  id: "ticket-1",
  user_id: "user-1",
  category: "cv_documentos",
  subject: "No puedo subir mi CV",
  status: "abierto",
  created_at: "2026-08-10T12:00:00-03:00",
  updated_at: "2026-08-10T12:00:00-03:00",
};

async function mockSession(page: Page, session: typeof WORKER_SESSION) {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) })
  );
}

test("el trabajador abre un ticket de soporte y lo ve en su lista", async ({ page }) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockSession(page, WORKER_SESSION);

  let created = false;
  await page.route("**/api/v1/support/tickets/mine", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(created ? [TICKET] : []),
    })
  );
  await page.route("**/api/v1/support/tickets", (route) => {
    if (route.request().method() === "POST") {
      created = true;
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(TICKET) });
    }
    return route.continue();
  });
  await page.route(`**/api/v1/support/tickets/${TICKET.id}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...TICKET,
        messages: [
          {
            id: "msg-1",
            ticket_id: TICKET.id,
            sender_user_id: "user-1",
            body: "Me da error al elegir el archivo.",
            created_at: "2026-08-10T12:00:00-03:00",
          },
        ],
      }),
    })
  );

  await page.goto("/support");
  await expect(page.getByText("Todavía no abriste ningún ticket")).toBeVisible();

  await page.getByRole("button", { name: "Nuevo" }).click();
  await expect(page.getByRole("dialog", { name: "Nuevo ticket de soporte" })).toBeVisible();

  await page.getByLabel("Categoría").selectOption("cv_documentos");
  await page.getByLabel("Asunto").fill("No puedo subir mi CV");
  await page.getByLabel("Contanos qué pasa").fill("Me da error al elegir el archivo.");
  await page.getByRole("button", { name: "Enviar" }).click();

  await expect(page).toHaveURL(`/support/${TICKET.id}`);
  await expect(page.getByText("No puedo subir mi CV")).toBeVisible();
  await expect(page.getByText("Me da error al elegir el archivo.")).toBeVisible();
});

test("el admin lista los tickets y puede responder", async ({ page }) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockSession(page, ADMIN_SESSION);

  await page.route("**/api/v1/support/tickets?status=abierto", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          ...TICKET,
          user_full_name: "Trabajadora Soporte",
          user_email: "worker.support@staffya.com",
          user_role: "worker",
          message_count: 1,
          last_message_at: "2026-08-10T12:00:00-03:00",
        },
      ]),
    })
  );

  let replied = false;
  await page.route(`**/api/v1/support/tickets/${TICKET.id}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...TICKET,
        messages: [
          {
            id: "msg-1",
            ticket_id: TICKET.id,
            sender_user_id: "user-1",
            body: "Me da error al elegir el archivo.",
            created_at: "2026-08-10T12:00:00-03:00",
          },
          ...(replied
            ? [
                {
                  id: "msg-2",
                  ticket_id: TICKET.id,
                  sender_user_id: "user-9",
                  body: "Ya lo revisamos, probá de nuevo.",
                  created_at: "2026-08-10T12:05:00-03:00",
                },
              ]
            : []),
        ],
      }),
    })
  );
  await page.route(`**/api/v1/support/tickets/${TICKET.id}/messages`, (route) => {
    replied = true;
    return route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        id: "msg-2",
        ticket_id: TICKET.id,
        sender_user_id: "user-9",
        body: "Ya lo revisamos, probá de nuevo.",
        created_at: "2026-08-10T12:05:00-03:00",
      }),
    });
  });

  await page.goto("/admin/support");
  await expect(page.getByText("No puedo subir mi CV")).toBeVisible();
  await expect(page.getByText("Trabajadora Soporte")).toBeVisible();

  await page.getByText("No puedo subir mi CV").click();
  await expect(page).toHaveURL(`/support/${TICKET.id}`);

  await page.getByPlaceholder("Escribí tu respuesta...").fill("Ya lo revisamos, probá de nuevo.");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText("Ya lo revisamos, probá de nuevo.")).toBeVisible();
});

/**
 * Confusión real de Julieta: abrió un ticket de prueba como trabajador y
 * nunca lo vio "en su perfil de admin" — porque el ítem "Soporte" de
 * `/profile` mandaba a `/support` ("mis tickets", `GET /support/tickets/mine`)
 * para cualquier rol, admin incluido. Para un admin esa lista es casi
 * siempre vacía; el inbox real de tickets de otros usuarios está en
 * `/admin/support`. Este test fija que el ítem rutea distinto según el rol.
 */
test("el ítem Soporte del perfil lleva al admin al inbox, no a sus propios tickets", async ({
  page,
}) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockSession(page, ADMIN_SESSION);

  await page.route("**/api/v1/support/tickets?status=abierto", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  await page.goto("/profile");
  await page.getByText("Soporte").click();
  await expect(page).toHaveURL("/admin/support");
});
