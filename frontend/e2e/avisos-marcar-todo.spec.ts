import { test, expect, type Page, type WebSocketRoute } from "@playwright/test";
import { deContrato, fulfillContrato } from "./contrato";
import { blockExternalHosts, injectSession, skipSplash } from "./mocks";

/**
 * «Marcar todas como leídas» (CON-10 / ESC-04): el pedido lleva los avisos que
 * la campanita tenía en pantalla, y el servidor marca sólo esos. Un aviso que
 * existe en el servidor pero la lista cargada no trae (llegó después, o quedó
 * fuera de los 50 de `GET /notifications`) no va en el pedido.
 */

async function setup(page: Page) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await page.route("**/api/v1/**", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
      : route.continue()
  );
  await page.route("**/api/v1/auth/me", (route) => fulfillContrato(route, "auth_me_worker"));
  const sockets: WebSocketRoute[] = [];
  await page.routeWebSocket(/\/notifications\/ws/, (ws) => {
    sockets.push(ws);
  });
  const pedidos: unknown[] = [];
  // El servidor tiene tres sin leer; la lista que trae (`GET`) sólo los dos primeros.
  await page.route("**/api/v1/notifications", (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(deContrato("avisos_trabajador", [{ id: "notification-3" }, { id: "notification-4" }])),
    });
  });
  await page.route("**/api/v1/notifications/read-all", (route) => {
    pedidos.push(route.request().postDataJSON());
    return fulfillContrato(route, "avisos_leer_todo");
  });
  return { sockets, pedidos };
}

test("marcar todas manda sólo los avisos que se mostraron", async ({ page }) => {
  const { pedidos } = await setup(page);
  await page.goto("/feed");

  const campana = page.getByRole("button", { name: "Avisos" });
  await expect(campana).toHaveText("2");
  await campana.click();
  await page.getByRole("button", { name: "Marcar todas como leídas" }).click();

  await expect(campana).not.toHaveText("2");
  await expect.poll(() => pedidos.length).toBe(1);
  const { ids } = pedidos[0] as { ids: string[] };
  expect([...ids].sort()).toEqual(["notification-3", "notification-4"]);
});

test("un aviso que llega por el socket y ya se ve va en la lista", async ({ page }) => {
  const { sockets, pedidos } = await setup(page);
  await page.goto("/feed");
  const campana = page.getByRole("button", { name: "Avisos" });
  await expect(campana).toHaveText("2");

  const [nuevo] = deContrato("avisos_trabajador", [
    { id: "notification-9", type: "shift_assigned", title: "Te asignaron un turno" },
  ]);
  await expect.poll(() => sockets.length).toBeGreaterThan(0);
  sockets[0].send(JSON.stringify(nuevo));
  await expect(campana).toHaveText("3");

  await campana.click();
  await page.getByRole("button", { name: "Marcar todas como leídas" }).click();
  await expect.poll(() => pedidos.length).toBe(1);
  const { ids } = pedidos[0] as { ids: string[] };
  expect([...ids].sort()).toEqual(["notification-3", "notification-4", "notification-9"]);
});
