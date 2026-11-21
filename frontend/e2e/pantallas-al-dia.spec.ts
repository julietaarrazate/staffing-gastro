import { test, expect, type Page, type WebSocketRoute } from "@playwright/test";
import { deContrato, fulfillContrato } from "./contrato";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * Pantallas al día (G1, U013/U014): un aviso que llega por el WebSocket de la
 * campanita hace que la pantalla abierta se ponga al día sola, sin recargar.
 *  - El trabajador confirma y el panel del comercio pasa a «Confirmado».
 *  - El comercio cancela y «Mis turnos» del trabajador deja de ofrecer «Llegué».
 */

// Turno del trabajador asignado, aviso y sesión: respuestas reales del backend
// (e2e/contrato). `shift` sirve para `/shifts/me`, `/shifts/mine` y `/shifts/s1`.
function shift(status: string) {
  return deContrato("turnos_del_comercio_con_asignado", [
    { id: "s1", status, worker_name: "Juan Pérez", company_name: "Bar La Esquina" },
  ])[0];
}

function aviso(type: string) {
  const [real] = deContrato("avisos_trabajador", [
    { id: `n-${type}`, type, title: "Novedad en tu turno", message: "Algo cambió.", link: null },
  ]);
  return real;
}

async function setup(page: Page, role: "employer" | "worker") {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await page.route("**/api/v1/**", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
      : route.continue()
  );
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) =>
    fulfillContrato(route, role === "employer" ? "auth_me_employer" : "auth_me_worker")
  );
  // Guarda el socket de la campanita para mandarle un aviso después de cargar.
  const sockets: WebSocketRoute[] = [];
  await page.routeWebSocket(/\/notifications\/ws/, (ws) => {
    sockets.push(ws);
  });
  return sockets;
}

test("el trabajador confirma y el panel del comercio pasa solo a «Confirmado»", async ({ page }) => {
  const sockets = await setup(page, "employer");
  let status = "asignado";
  await page.route("**/api/v1/shifts/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([shift(status)]),
    })
  );
  await page.goto("/shifts");
  // El estado se mira en el sello: desde los pasos tachados (2026-11-19)
  // «Asignado» también es una palabra de los pasos, y sigue ahí (tachada o
  // actual) después de confirmar.
  const estado = page.getByTestId("shifts-panel-list").getByTestId("shift-status");
  await expect(estado).toHaveText("Asignado");

  // Pasa en el servidor y llega el aviso: la pantalla no se recarga.
  status = "confirmado";
  await expect.poll(() => sockets.length).toBeGreaterThan(0);
  sockets[0].send(JSON.stringify(aviso("shift_confirmed")));

  await expect(estado).toHaveText("Confirmado");
});

test("el comercio cancela y «Mis turnos» deja de ofrecer «Llegué»", async ({ page }) => {
  const sockets = await setup(page, "worker");
  let status = "confirmado";
  await page.route("**/api/v1/shifts/mine", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([shift(status)]),
    })
  );
  await page.clock.setFixedTime(new Date("2037-12-16T12:00:00-03:00")); // Mis turnos filtra por semana
  await page.goto("/my-shifts");
  await expect(page.getByRole("button", { name: "Llegué" })).toBeVisible();

  status = "cancelado";
  await expect.poll(() => sockets.length).toBeGreaterThan(0);
  sockets[0].send(JSON.stringify(aviso("shift_cancelled")));

  await expect(page.getByRole("button", { name: "Llegué" })).toHaveCount(0);
});

test("chat nuevo sin mensajes: el encabezado dice con quién es aunque la lista no lo traiga", async ({ page }) => {
  await setup(page, "worker");
  await page.route("**/api/v1/shifts/s1", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(shift("confirmado")) })
  );
  await page.goto("/chats/s1");
  await expect(page.getByText("Bar La Esquina").first()).toBeVisible();
  await expect(page.getByText("Mozo").first()).toBeVisible();
});
