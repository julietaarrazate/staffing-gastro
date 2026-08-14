import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * Asistente general del panel del comercio, como botón flotante global
 * (pedido de Julieta: separado del wizard, "un botón afuera", que entienda
 * "si es un evento, si es un turno, y toda la app, no sólo lo básico") —
 * antes sólo vivía adentro de /shifts/new y sólo sabía armar un turno.
 * `POST /assistant/query` clasifica el pedido en uno de 5 intents; estos
 * tests cubren cada rama del frontend.
 */

const EMPLOYER_SESSION = {
  id: "user-1",
  email: "demo.comercio@staffya.com",
  full_name: "Comercio Demo",
  role: "employer",
  status: "activo",
  is_active: true,
  is_verified: true,
};

const WORKER_SESSION = {
  id: "user-2",
  email: "worker.demo@staffya.com",
  full_name: "Trabajador Demo",
  role: "worker",
  status: "activo",
  is_active: true,
  is_verified: true,
};

async function mockSession(page: Page, session: typeof EMPLOYER_SESSION) {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) })
  );
}

/** Respuesta base de `POST /assistant/query`: todo en `null`/default salvo
 * lo que cada test necesite pisar para su intent. */
function assistantResponse(overrides: Record<string, unknown>) {
  return {
    intent: "desconocido",
    message: null,
    position: null,
    start_at: null,
    end_at: null,
    pay_amount: null,
    urgent: null,
    meal: null,
    tips: null,
    dress_code: null,
    event_positions: null,
    query_summary: null,
    query_count: null,
    query_tab: null,
    search_position: null,
    matched_shift_id: null,
    ...overrides,
  };
}

/** En `/shifts` (panel del comercio) el disparador es la barra prominente
 * (`AIAssistantBar`, "¿Qué necesitás?") — la cápsula flotante se oculta ahí
 * a propósito para no duplicar el mismo punto de entrada dos veces en la
 * misma pantalla (ver `AIAssistantFab`). Misma hoja, mismo comportamiento. */
async function openAssistantAndAsk(page: Page, text: string) {
  await page.getByRole("button", { name: "¿Qué necesitás?" }).click();
  await expect(page.getByRole("dialog", { name: "Asistente" })).toBeVisible();
  await page
    .getByPlaceholder("Ej: necesito un mozo el sábado a la noche, se paga 45000")
    .fill(text);
  await page.getByRole("button", { name: "Completar" }).click();
}

test("crear_turno: llega al wizard de turno único con el puesto ya precargado", async ({
  page,
}) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockSession(page, EMPLOYER_SESSION);
  await page.route("**/api/v1/shifts/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/v1/assistant/query", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        assistantResponse({
          intent: "crear_turno",
          position: "mozo",
          start_at: "2026-08-15T20:00:00-03:00",
          end_at: "2026-08-16T02:00:00-03:00",
          pay_amount: "45000",
          urgent: false,
          meal: false,
          tips: true,
        })
      ),
    })
  );

  await page.goto("/shifts");
  await openAssistantAndAsk(page, "necesito un mozo el sábado a la noche, se paga 45000");

  await expect(page).toHaveURL(/\/shifts\/new/);
  await expect(page.getByRole("button", { name: "Continuar" })).toBeEnabled();
});

test("crear_evento: llega al wizard de evento con los roles ya precargados", async ({ page }) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockSession(page, EMPLOYER_SESSION);
  await page.route("**/api/v1/shifts/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/v1/assistant/query", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        assistantResponse({
          intent: "crear_evento",
          event_positions: [
            { position: "ayudante_cocina", quantity: 1 },
            { position: "bartender", quantity: 1 },
            { position: "mozo", quantity: 2 },
          ],
          start_at: "2026-08-15T20:00:00-03:00",
          end_at: "2026-08-16T02:00:00-03:00",
          pay_amount: "45000",
        })
      ),
    })
  );

  await page.goto("/shifts");
  await openAssistantAndAsk(page, "necesito crear un evento: 1 bachero, 1 bartender, 2 mozos");

  await expect(page).toHaveURL(/\/shifts\/new-event/);
  await expect(page.getByRole("button", { name: "Sacar este rol" })).toHaveCount(3);
});

test("consultar_turnos: muestra el resumen adentro del asistente y lleva al panel filtrado", async ({
  page,
}) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockSession(page, EMPLOYER_SESSION);
  await page.route("**/api/v1/shifts/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/v1/assistant/query", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        assistantResponse({
          intent: "consultar_turnos",
          query_summary: "Tenés 2 turnos urgentes sin cubrir.",
          query_count: 2,
          query_tab: "buscando",
        })
      ),
    })
  );

  await page.goto("/shifts");
  await openAssistantAndAsk(page, "¿qué tengo urgente?");

  await expect(page.getByText("Tenés 2 turnos urgentes sin cubrir.")).toBeVisible();
  await page.getByRole("button", { name: "Ver en el panel" }).click();
  await expect(page).toHaveURL("/shifts?tab=buscando");
});

test("buscar_candidatos: navega a /search con el puesto ya filtrado", async ({ page }) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockSession(page, EMPLOYER_SESSION);
  await page.route("**/api/v1/shifts/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/v1/assistant/query", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(assistantResponse({ intent: "buscar_candidatos", search_position: "mozo" })),
    })
  );
  await page.route("**/api/v1/matching/search**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  await page.goto("/shifts");
  await openAssistantAndAsk(page, "buscame mozos disponibles");

  await expect(page).toHaveURL("/search?skill=mozo");
});

test("ver_postulantes: con match, navega directo a los postulantes del turno", async ({ page }) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockSession(page, EMPLOYER_SESSION);
  await page.route("**/api/v1/shifts/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/v1/assistant/query", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        assistantResponse({ intent: "ver_postulantes", matched_shift_id: "shift-123" })
      ),
    })
  );
  await page.route("**/api/v1/applications/shifts/shift-123", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/v1/shifts/shift-123/candidates**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  await page.goto("/shifts");
  await openAssistantAndAsk(page, "¿quién se postuló al turno de mozo?");

  await expect(page).toHaveURL(/\/shifts\/shift-123\/candidates/);
});

test("desconocido: muestra un mensaje amigable sin navegar a ningún lado", async ({ page }) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockSession(page, EMPLOYER_SESSION);
  await page.route("**/api/v1/shifts/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/v1/assistant/query", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        assistantResponse({ intent: "desconocido", message: "No entendí bien qué necesitás." })
      ),
    })
  );

  await page.goto("/shifts");
  await openAssistantAndAsk(page, "esto no significa nada");

  await expect(page.getByText("No entendí bien qué necesitás.")).toBeVisible();
  await expect(page).toHaveURL("/shifts");
});

test("en /shifts la cápsula flotante se oculta y aparece la barra prominente en su lugar", async ({
  page,
}) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockSession(page, EMPLOYER_SESSION);
  await page.route("**/api/v1/shifts/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  await page.goto("/shifts");
  await expect(page.getByRole("button", { name: "Asistente de turnos con IA" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "¿Qué necesitás?" })).toBeVisible();
});

test("el botón flotante no aparece en /shifts/new ni en /shifts/new-event (ya tienen el cuadro integrado)", async ({
  page,
}) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockSession(page, EMPLOYER_SESSION);

  await page.goto("/shifts/new");
  await expect(page.getByRole("button", { name: "Asistente de turnos con IA" })).toHaveCount(0);

  await page.goto("/shifts/new-event");
  await expect(page.getByRole("button", { name: "Asistente de turnos con IA" })).toHaveCount(0);
});

test("el botón flotante no aparece durante el onboarding (/bienvenida)", async ({ page }) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockSession(page, EMPLOYER_SESSION);

  await page.goto("/bienvenida");
  await expect(page.getByRole("button", { name: "Asistente de turnos con IA" })).toHaveCount(0);
});

test("el botón flotante no aparece para un trabajador (sólo el comercio publica turnos)", async ({
  page,
}) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockSession(page, WORKER_SESSION);
  await page.route("**/api/v1/shifts**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  await page.goto("/feed");
  await expect(page.getByRole("button", { name: "Asistente de turnos con IA" })).toHaveCount(0);
});
