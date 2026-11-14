import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * G9 (U028, U029): cuando una acción del turno falla porque el turno cambió
 * (el comercio lo canceló, el trabajador ya lo había confirmado), la pantalla
 * muestra el motivo en castellano de persona Y recarga la lista, para no seguir
 * ofreciendo un botón que ya no corresponde.
 */

const SESSION = {
  id: "user-1",
  email: "demo@staffya.com",
  full_name: "Demo",
  is_active: true,
  is_verified: true,
  status: "activo",
};

function shift(status: string) {
  return {
    id: "shift-1",
    company_id: "company-1",
    position: "mozo",
    quantity: 1,
    start_at: "2026-12-20T20:00:00-03:00",
    end_at: "2026-12-20T23:00:00-03:00",
    pay_amount: "15000",
    currency: "ARS",
    tips: false,
    dress_code: null,
    urgent: false,
    address: "Thames 1234",
    city: "Palermo, CABA",
    latitude: null,
    longitude: null,
    title: null,
    description: null,
    status,
    worker_profile_id: "wp-1",
    worker_name: "Trabajador Demo",
    en_route_latitude: null,
    en_route_longitude: null,
    en_route_at: null,
    check_in_latitude: null,
    check_in_longitude: null,
    check_in_at: null,
    check_out_latitude: null,
    check_out_longitude: null,
    check_out_at: null,
    paid_at: null,
    no_show_at: null,
    last_no_show_worker_profile_id: null,
    event_id: null,
    event_name: null,
    created_at: "2026-12-01T12:00:00-03:00",
    company_name: null,
    company_logo_url: null,
  };
}

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

async function base(page: Page, role: "worker" | "employer") {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json({ ...SESSION, role })));
  await page.route("**/api/v1/reviews/shifts/*", (r) => r.fulfill(json([])));
}

test("Trabajador: Confirmar falla porque el comercio canceló; muestra el motivo y baja el botón", async ({ page }) => {
  await base(page, "worker");
  const server = { status: "asignado" };
  let listados = 0;
  await page.route("**/api/v1/shifts/mine", (r) => {
    listados += 1;
    return r.fulfill(json([shift(server.status)]));
  });
  await page.route("**/api/v1/applications/mine", (r) => r.fulfill(json([])));
  await page.route("**/api/v1/saved-shifts", (r) => r.fulfill(json([])));
  await page.route("**/api/v1/workers/me/profile", (r) => r.fulfill({ status: 404, body: "{}" }));
  await page.route("**/api/v1/shifts/shift-1/confirm", (r) => {
    server.status = "cancelado"; // el comercio canceló mientras la pantalla estaba abierta
    return r.fulfill(json({ detail: "El comercio canceló este turno." }, 400));
  });
  await page.goto("/my-shifts");

  const confirmar = page.getByRole("button", { name: "Confirmar" });
  await expect(confirmar).toBeVisible();
  const antes = listados;
  await confirmar.click();

  await expect(page.getByText("El comercio canceló este turno.")).toBeVisible();
  await expect.poll(() => listados).toBeGreaterThan(antes);
  await expect(page.getByRole("button", { name: "Confirmar" })).toHaveCount(0);
});

test("Comercio: Cancelar falla porque ya estaba cancelado; muestra el motivo y recarga la lista", async ({ page }) => {
  await base(page, "employer");
  const server = { status: "confirmado" };
  let listados = 0;
  await page.route("**/api/v1/shifts/me", (r) => {
    listados += 1;
    return r.fulfill(json([shift(server.status)]));
  });
  await page.route(/\/api\/v1\/shifts\/shift-1$/, (r) =>
    r.fulfill(json({ ...shift(server.status), worker_name: undefined, company_name: "Bar Palermo" }))
  );
  await page.route("**/api/v1/shifts/shift-1/cancel", (r) => {
    server.status = "cancelado";
    return r.fulfill(json({ detail: "Ya cancelaste este turno." }, 400));
  });
  await page.goto("/shifts");

  await page.getByRole("button", { name: "Más acciones" }).click();
  await page
    .getByRole("dialog", { name: "Más acciones" })
    .getByRole("button", { name: "Cancelar turno" })
    .click();
  const dialog = page.getByRole("dialog", { name: "¿Cancelar este turno?" });
  await expect(dialog.getByTestId("cancel-checking")).toHaveCount(0);
  const antes = listados;
  await dialog.getByRole("button", { name: "Sí, cancelar turno" }).click();

  await expect(page.getByText("Ya cancelaste este turno.")).toBeVisible();
  await expect.poll(() => listados).toBeGreaterThan(antes);
});
