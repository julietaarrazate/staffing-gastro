import { test, expect, type Page, type WebSocketRoute } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * Pantallas al día (G1, U013/U014): un aviso que llega por el WebSocket de la
 * campanita hace que la pantalla abierta se ponga al día sola, sin recargar.
 *  - El trabajador confirma y el panel del comercio pasa a «Confirmado».
 *  - El comercio cancela y «Mis turnos» del trabajador deja de ofrecer «Llegué».
 */

function shift(status: string) {
  return {
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
    status,
    worker_profile_id: "wp1",
    worker_name: "Juan Pérez",
    created_at: "2030-07-01T12:00:00-03:00",
    company_name: "Bar La Esquina",
    company_logo_url: null,
  };
}

function aviso(type: string) {
  return {
    id: `n-${type}`,
    type,
    title: "Novedad en tu turno",
    message: "Algo cambió.",
    read: false,
    link: null,
    created_at: "2030-07-01T12:00:00Z",
  };
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
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "u1",
        email: "u@oido.test",
        full_name: role === "employer" ? "Bar La Esquina" : "Juan Pérez",
        role,
        status: "activo",
        is_active: true,
        is_verified: true,
      }),
    })
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
  const lista = page.getByTestId("shifts-panel-list");
  await expect(lista.getByText("Asignado", { exact: true })).toBeVisible();
  await expect(lista.getByText("Confirmado", { exact: true })).toHaveCount(0);

  // Pasa en el servidor y llega el aviso: la pantalla no se recarga.
  status = "confirmado";
  await expect.poll(() => sockets.length).toBeGreaterThan(0);
  sockets[0].send(JSON.stringify(aviso("shift_confirmed")));

  await expect(lista.getByText("Confirmado", { exact: true })).toBeVisible();
  await expect(lista.getByText("Asignado", { exact: true })).toHaveCount(0);
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
