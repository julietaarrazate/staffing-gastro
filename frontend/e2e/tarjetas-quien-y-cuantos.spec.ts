import { test, expect, type Page, type WebSocketRoute } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * G19 (U065, U024, U025): las tarjetas dicen quién y cuántos.
 *  - Panel del comercio: «Elegir a alguien (2)», y la cifra se pone al día sola
 *    cuando llega otro postulante (aviso por el WebSocket de la campanita).
 *  - Panel del comercio: «Asignado a Ana», «Beto confirmó».
 *  - Matches → Postulaciones: la tarjeta dice de qué comercio es el turno.
 */

function shift(overrides: Record<string, unknown>) {
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
    status: "publicado",
    worker_profile_id: null,
    created_at: "2030-07-01T12:00:00-03:00",
    company_name: "Bar La Esquina",
    company_logo_url: null,
    ...overrides,
  };
}

function json(body: unknown) {
  return { status: 200, contentType: "application/json", body: JSON.stringify(body) };
}

async function setup(page: Page, role: "employer" | "worker") {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await page.route("**/api/v1/**", (route) =>
    route.request().method() === "GET" ? route.fulfill(json([])) : route.continue()
  );
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill(
      json({
        id: "u1",
        email: "u@oido.test",
        full_name: role === "employer" ? "Bar La Esquina" : "Juan Pérez",
        role,
        status: "activo",
        is_active: true,
        is_verified: true,
      })
    )
  );
  const sockets: WebSocketRoute[] = [];
  await page.routeWebSocket(/\/notifications\/ws/, (ws) => {
    sockets.push(ws);
  });
  return sockets;
}

test("«Elegir a alguien» lleva la cantidad y se actualiza sola cuando llega un postulante", async ({ page }) => {
  const sockets = await setup(page, "employer");
  let pending: number | null = 2;
  await page.route("**/api/v1/shifts/me", (route) =>
    route.fulfill(json([shift({ pending_applicants_count: pending })]))
  );
  await page.goto("/shifts");
  const lista = page.getByTestId("shifts-panel-list");
  await expect(lista.getByRole("link", { name: "Elegir a alguien (2)" })).toBeVisible();

  pending = 3;
  await expect.poll(() => sockets.length).toBeGreaterThan(0);
  sockets[0].send(
    JSON.stringify({
      id: "n-1",
      type: "new_application",
      title: "Nuevo postulante",
      message: "Alguien se postuló.",
      read: false,
      link: null,
      created_at: "2030-07-01T12:00:00Z",
    })
  );

  await expect(lista.getByRole("link", { name: "Elegir a alguien (3)" })).toBeVisible();
  await expect(lista.getByRole("link", { name: "Elegir a alguien (2)" })).toHaveCount(0);
});

test("sin postulantes el botón queda «Elegir a alguien», sin cifra", async ({ page }) => {
  await setup(page, "employer");
  await page.route("**/api/v1/shifts/me", (route) =>
    route.fulfill(json([shift({ pending_applicants_count: 0 })]))
  );
  await page.goto("/shifts");
  const link = page.getByTestId("shifts-panel-list").getByRole("link", { name: /Elegir a alguien/ });
  await expect(link).toHaveText("Elegir a alguien");
});

test("el panel dice con quién está cada turno", async ({ page }) => {
  await setup(page, "employer");
  await page.route("**/api/v1/shifts/me", (route) =>
    route.fulfill(
      json([
        shift({ id: "a", status: "asignado", worker_profile_id: "w1", worker_name: "Ana Gómez" }),
        shift({ id: "b", status: "confirmado", worker_profile_id: "w2", worker_name: "Beto Ruiz" }),
        shift({ id: "c", status: "confirmado", worker_profile_id: "w3", worker_name: "" }),
      ])
    )
  );
  await page.goto("/shifts");
  const lista = page.getByTestId("shifts-panel-list");
  await expect(lista.getByText("Asignado a Ana.")).toBeVisible();
  await expect(lista.getByText("Beto confirmó.")).toBeVisible();
  // Sin nombre, la línea de siempre.
  await expect(lista.getByText(/^Confirmó\. Te avisamos/)).toHaveCount(1);
});

test("Matches → Postulaciones dice de qué comercio es cada turno", async ({ page }) => {
  await setup(page, "worker");
  await page.route(/\/api\/v1\/applications\/mine(\?.*)?$/, (route) =>
    route.fulfill(
      json([
        {
          id: "app-1",
          shift_id: "s1",
          worker_profile_id: "wp1",
          status: "pendiente",
          created_at: "2030-07-02T10:00:00-03:00",
          shift: shift({ company_name: "Parrilla El Ceibo" }),
        },
      ])
    )
  );
  await page.goto("/my-shifts");
  await page.getByRole("button", { name: "Postulaciones (1)" }).click();
  await expect(page.getByText("Parrilla El Ceibo")).toBeVisible();
});
