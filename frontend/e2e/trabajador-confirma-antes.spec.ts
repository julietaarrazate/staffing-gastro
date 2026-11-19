import { test, expect, type Page } from "@playwright/test";
import { deContrato, fulfillContrato } from "./contrato";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * T2a (U004 y U005): las acciones del trabajador sin vuelta atrás piden
 * confirmación, y un toque que cae sobre un botón recién aparecido no cuenta.
 * La API está simulada: el spec cuenta los POST que llegan al "servidor".
 */

// Turno de `GET /shifts/mine` (e2e/contrato): con la persona ya asignada.
function shiftFixture(status: string, startOffsetMin: number) {
  const start = new Date(Date.now() + startOffsetMin * 60_000);
  const end = new Date(start.getTime() + 5 * 3_600_000);
  return deContrato("turnos_asignados_trabajador", [
    {
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      status,
      worker_profile_id: "profile-1",
      latitude: -34.5875,
      longitude: -58.4257,
    },
  ])[0];
}

async function setup(page: Page, initial: { status: string; startOffsetMin: number }) {
  const state = { shift: shiftFixture(initial.status, initial.startOffsetMin) };
  const posts: string[] = [];
  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation({ latitude: -34.5875, longitude: -58.4257 });
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  const json = (body: unknown) => ({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
  await page.route("**/api/v1/auth/me", (r) => fulfillContrato(r, "auth_me_worker"));
  await page.route("**/api/v1/shifts/mine", (r) => r.fulfill(json([state.shift])));
  await page.route("**/api/v1/applications/mine", (r) => r.fulfill(json([])));
  await page.route("**/api/v1/saved-shifts", (r) => r.fulfill(json([])));
  await page.route("**/api/v1/workers/me/profile", (r) => fulfillContrato(r, "perfil_trabajador_sin_crear"));
  await page.route(/\/api\/v1\/shifts\/shift-1\/(reject|worker-cancel|check-in|check-out)$/, (r) => {
    const accion = r.request().url().split("/").pop() as string;
    posts.push(accion);
    if (accion === "check-in") state.shift = { ...state.shift, status: "check_in" };
    if (accion === "check-out") state.shift = { ...state.shift, status: "check_out" };
    if (accion === "reject" || accion === "worker-cancel") {
      state.shift = { ...state.shift, status: "buscando_personal" };
    }
    return r.fulfill(json(state.shift));
  });
  await page.goto("/my-shifts");
  return { posts, state };
}

test("Rechazar pide confirmación y un toque no llama al servidor", async ({ page }) => {
  const { posts } = await setup(page, { status: "asignado", startOffsetMin: 600 });
  await page.getByRole("button", { name: "Rechazar" }).click();
  await expect(page.getByText("¿Rechazar este turno?")).toBeVisible();
  expect(posts).toEqual([]);
  await page.getByRole("button", { name: "Volver" }).click();
  expect(posts).toEqual([]);
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Rechazar" }).click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Sí, rechazar" }).click();
  await expect.poll(() => posts).toEqual(["reject"]);
});

test("Cancelar mi asignación pide confirmación", async ({ page }) => {
  const { posts } = await setup(page, { status: "confirmado", startOffsetMin: 600 });
  await page.getByRole("button", { name: "Cancelar mi asignación" }).click();
  await expect(page.getByText("¿Cancelar tu asignación?")).toBeVisible();
  expect(posts).toEqual([]);
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Sí, cancelar" }).click();
  await expect.poll(() => posts).toEqual(["worker-cancel"]);
});

test("Me fui pide confirmación y no la acepta el segundo toque", async ({ page }) => {
  const { posts } = await setup(page, { status: "check_in", startOffsetMin: -60 });
  await page.getByRole("button", { name: "Me fui" }).click();
  await expect(page.getByText("¿Marcar tu salida?")).toBeVisible();
  expect(posts).toEqual([]);
  // Segundo toque inmediato sobre el botón de confirmar: no cuenta.
  await page.getByRole("button", { name: "Sí, me fui" }).click({ force: true });
  expect(posts).toEqual([]);
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Sí, me fui" }).click();
  await expect.poll(() => posts).toEqual(["check-out"]);
});

test("Dos toques seguidos en Llegué dejan la llegada marcada y sin salida", async ({ page }) => {
  const { posts, state } = await setup(page, { status: "confirmado", startOffsetMin: -30 });
  const llegue = page.getByRole("button", { name: "Llegué" });
  await llegue.click();
  await page.waitForTimeout(150);
  await page.getByRole("button", { name: "Me fui" }).click({ force: true, timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(300);
  await expect(page.getByText("¿Marcar tu salida?")).toHaveCount(0);
  expect(posts).toEqual(["check-in"]);
  expect(state.shift.status).toBe("check_in");
});

test("Llegué antes de que empiece: no ofrece Me fui y dice cuándo empieza", async ({ page }) => {
  await setup(page, { status: "check_in", startOffsetMin: 20 });
  await expect(page.getByText(/Llegada marcada · el turno empieza hoy a las|Llegada marcada · el turno empieza mañana a las/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Me fui" })).toHaveCount(0);
});
