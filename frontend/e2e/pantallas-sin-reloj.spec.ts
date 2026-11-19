import { test, expect, type WebSocketRoute } from "@playwright/test";
import { deContrato, fulfillContrato } from "./contrato";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * Pantallas con un estado que vence o se cierra (VIE-02, VIE-03): no se
 * quedan mostrando lo viejo.
 *  - Buscar: un turno que se cubre sale de la lista cuando llega el aviso.
 *  - «Disponible ahora»: la tarjeta se apaga sola al llegar la hora.
 */

test.use({ viewport: { width: 1280, height: 900 } });

async function setup(page: import("@playwright/test").Page) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) => fulfillContrato(route, "auth_me_worker"));
  await page.route("**/api/v1/workers/me/profile", (route) => fulfillContrato(route, "perfil_trabajador"));
  await page.route("**/api/v1/applications/mine", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  const sockets: WebSocketRoute[] = [];
  await page.routeWebSocket(/\/notifications\/ws/, (ws) => {
    sockets.push(ws);
  });
  return sockets;
}

test("Buscar: el turno que se cubrió sale de la lista cuando llega el aviso", async ({ page }) => {
  const sockets = await setup(page);
  const [uno] = deContrato("feed");
  const dos = { ...uno, id: "shift-2", company_name: "Bar Recoleta", city: "Recoleta" };
  let turnos = [uno, dos];
  await page.route("**/api/v1/shifts/feed*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(turnos) })
  );

  await page.goto("/buscar");
  await expect(page.getByText("Bar Recoleta").first()).toBeVisible();

  // Se cubre en el servidor y llega un aviso: la lista no se recarga a mano.
  turnos = [uno];
  await expect.poll(() => sockets.length).toBeGreaterThan(0);
  const [aviso] = deContrato("avisos_trabajador", [
    { id: "n-1", type: "shift_cancelled", title: "Novedad", message: "Algo cambió.", link: null },
  ]);
  sockets[0].send(JSON.stringify(aviso));

  await expect(page.getByText("Bar Recoleta")).toHaveCount(0);
  await expect(page.getByText(uno.company_name ?? "Bar Palermo").first()).toBeVisible();
});

test("Disponible ahora: la tarjeta se apaga sola al llegar la hora de vencimiento", async ({ page }) => {
  await setup(page);
  await page.clock.install({ time: new Date("2026-11-19T18:00:00-03:00") });
  const hasta = new Date("2026-11-19T22:00:00-03:00").toISOString();
  await page.route("**/api/v1/workers/me/available-now", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ active: true, until: hasta }),
    })
  );

  await page.goto("/profile");
  await expect(page.getByText(/Estás disponible ahora/)).toBeVisible();

  await page.clock.fastForward("04:00:05");
  await expect(page.getByText(/Estás disponible ahora/)).toHaveCount(0);
});
