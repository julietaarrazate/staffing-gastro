import { test, expect } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * «Volver a admin» desde el chat estando en «Ver como»: al cambiar la sesión,
 * la pantalla que se deja NO vuelve a pedir `/chats/...` con la sesión de la
 * admin (daba 404 y errores en la consola). La guarda de rol del chat corta los
 * pedidos apenas la sesión pasa a ser de admin.
 */
const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

const ADMIN = {
  id: "admin-1",
  email: "julietaarrazate@gmail.com",
  full_name: "Julieta Admin",
  role: "admin",
  status: "active",
  is_active: true,
  is_verified: true,
};
const TRABAJADOR = {
  id: "test-worker-1",
  email: "prueba.trabajador@oido.beta",
  full_name: "Prueba · Trabajador",
  role: "worker",
  status: "active",
  is_active: true,
  is_verified: true,
};
const TOKEN_ADMIN = "e2e-fake-access-token";
const TOKEN_IMPERSONADO = "e2e-impersonated-token";

test("volver a admin desde un chat no pide la conversación con la sesión de la admin", async ({ page }) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);

  const pedidosDeChat: { url: string; auth: string }[] = [];
  page.on("request", (req) => {
    const u = new URL(req.url());
    if (u.pathname.startsWith("/api/v1/chats")) {
      pedidosDeChat.push({ url: u.pathname, auth: req.headers()["authorization"] ?? "" });
    }
  });

  await page.route("**/api/v1/auth/me", (r) =>
    r.fulfill(json(r.request().headers()["authorization"] === `Bearer ${TOKEN_IMPERSONADO}` ? TRABAJADOR : ADMIN))
  );
  await page.route("**/api/v1/admin/**", (r) => r.fulfill(json([])));
  await page.route("**/api/v1/admin/test-accounts", (r) =>
    r.fulfill(json([{ id: TRABAJADOR.id, email: TRABAJADOR.email, full_name: TRABAJADOR.full_name, role: "worker" }]))
  );
  await page.route("**/api/v1/admin/users/test-worker-1/impersonate", (r) =>
    r.fulfill(json({ access_token: TOKEN_IMPERSONADO, token_type: "bearer", read_only: false, user: TRABAJADOR }))
  );
  await page.route("**/api/v1/shifts/feed", (r) => r.fulfill(json([])));
  await page.route("**/api/v1/workers/me/profile", (r) => r.fulfill(json({}, 404)));
  await page.route("**/api/v1/applications/mine", (r) => r.fulfill(json([])));
  await page.route("**/api/v1/chats", (r) =>
    r.fulfill(
      json([
        {
          shift_id: "shift-9",
          shift_title: "Mozo",
          other_party_name: "Bar Palermo",
          other_party_photo: null,
          last_message: "Hola",
          last_message_at: "2026-11-27T12:00:00Z",
          unread_count: 0,
        },
      ])
    )
  );
  await page.route("**/api/v1/chats/shift-9/messages", (r) =>
    r.request().headers()["authorization"] === `Bearer ${TOKEN_ADMIN}`
      ? r.fulfill(json({ detail: "Chat no encontrado" }, 404))
      : r.fulfill(json([]))
  );

  await page.goto("/admin/herramientas");
  await page.getByRole("button", { name: "Ver como trabajador" }).click();
  await expect(page).toHaveURL(/\/feed$/);

  // Sin recargar: una recarga volvería a pedir la sesión de «Ver como».
  await page.getByRole("link", { name: "Chats" }).first().click();
  await page.getByRole("link", { name: /Bar Palermo/ }).first().click();
  await expect(page).toHaveURL(/\/chats\/shift-9$/);
  const franja = page.getByRole("status").filter({ hasText: "Viendo como" });
  await expect(franja).toBeVisible();
  await expect.poll(() => pedidosDeChat.some((p) => p.url.endsWith("/shift-9/messages"))).toBe(true);

  const antes = pedidosDeChat.length;
  await franja.getByRole("button", { name: "Volver a admin" }).click();
  await expect(page).toHaveURL(/\/admin/);
  await page.waitForTimeout(800);

  const conSesionAdmin = pedidosDeChat.slice(antes).filter((p) => p.auth === `Bearer ${TOKEN_ADMIN}`);
  expect(conSesionAdmin).toEqual([]);
});
