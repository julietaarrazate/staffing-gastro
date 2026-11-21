import { test, expect, type Page } from "@playwright/test";
import { deContrato, fulfillContrato } from "./contrato";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * G9 (U028, U029): cuando una acción del turno falla porque el turno cambió
 * (el comercio lo canceló, el trabajador ya lo había confirmado), la pantalla
 * muestra el motivo en castellano de persona Y recarga la lista, para no seguir
 * ofreciendo un botón que ya no corresponde.
 */

// Respuestas reales del backend (e2e/contrato): el turno que ve cada parte y el
// `auth/me` de cada rol. Cambia sólo el estado.
const shift = (status: string, extra: Record<string, unknown> = {}) =>
  deContrato("turno_confirmado_trabajador", { status, ...extra });

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
  await page.route("**/api/v1/auth/me", (r) =>
    fulfillContrato(r, role === "worker" ? "auth_me_worker" : "auth_me_employer")
  );
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
    return fulfillContrato(r, "turno_cancelado_confirmar"); // 400, texto real del backend
  });
  await page.clock.setFixedTime(new Date("2037-12-16T12:00:00-03:00")); // Mis turnos filtra por semana
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
    return r.fulfill(json([shift(server.status, { worker_name: "Trabajador Demo" })]));
  });
  await page.route(/\/api\/v1\/shifts\/shift-1$/, (r) =>
    r.fulfill(json(shift(server.status)))
  );
  await page.route("**/api/v1/shifts/shift-1/cancel", (r) => {
    server.status = "cancelado";
    return fulfillContrato(r, "turno_cancelar_repetido"); // 400, texto real del backend
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
