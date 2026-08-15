import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * Asistente general del panel del comercio, como botón flotante global
 * (pedido de Julieta: separado del wizard, "un botón afuera", que entienda
 * "si es un evento, si es un turno, y toda la app, no sólo lo básico") —
 * antes sólo vivía adentro de /shifts/new y sólo sabía armar un turno.
 * `POST /assistant/query` clasifica el pedido en uno de varios intents;
 * estos tests cubren cada rama del frontend.
 *
 * El disparador (cápsula flotante o barra) navega a `/assistant` — la
 * pantalla dedicada (pedido de Julieta: "que no sea un botón escondido, que
 * tenga su lugar para pedirle"), ya no abre una hoja modal encima.
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
    verification_full_name: null,
    verification_verified: null,
    ...overrides,
  };
}

/** En `/shifts` (panel del comercio) el disparador es la barra prominente
 * (`AIAssistantBar`, "¿Qué necesitás?") — la cápsula flotante se oculta ahí
 * a propósito para no duplicar el mismo punto de entrada dos veces en la
 * misma pantalla (ver `AIAssistantFab`). Mismo destino (`/assistant`),
 * mismo comportamiento. */
async function openAssistantAndAsk(page: Page, text: string) {
  await page.getByRole("button", { name: "¿Qué necesitás?" }).click();
  await expect(page).toHaveURL("/assistant");
  await page
    .getByPlaceholder("Ej: necesito un mozo el sábado a la noche, se paga 45000")
    .fill(text);
  await page.getByRole("button", { name: "Completar" }).click();
}

test("crear_turno: con datos completos, salta directo a revisar y publicar", async ({
  page,
}) => {
  // Reporte real de Julieta probando la app: "no tiene sentido, en el paso
  // uno ya se bloquea" — un draft completo (puesto+horario+pago, los tres
  // presentes acá) tiene que aterrizar en el último paso (zona + resumen +
  // "Publicar turno"), no en el paso 1 pidiendo "Continuar" sobre campos
  // que ya están completos.
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
  await expect(page.getByRole("heading", { name: "¿Dónde es?" })).toBeVisible();
  await expect(page.getByText("Mozo/a").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Publicar turno" })).toBeVisible();
});

test("crear_turno: con datos parciales, frena justo en lo primero que falta", async ({
  page,
}) => {
  // El mismo criterio, del otro lado: si la IA no pudo inferir el pago (acá
  // no vino en el texto), el wizard tiene que frenar en el paso "Pago" —
  // ni en el paso 1 (puesto/horario ya están) ni saltarse directo a
  // publicar con un monto vacío.
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
          pay_amount: null,
          urgent: false,
          meal: false,
          tips: true,
        })
      ),
    })
  );

  await page.goto("/shifts");
  await openAssistantAndAsk(page, "necesito un mozo el sábado a la noche");

  await expect(page).toHaveURL(/\/shifts\/new/);
  await expect(page.getByRole("heading", { name: "¿Cuánto pagás?" })).toBeVisible();
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

test("consultar_verificacion: responde si el postulante nombrado está verificado", async ({
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
          intent: "consultar_verificacion",
          verification_full_name: "Camila Duarte",
          verification_verified: true,
        })
      ),
    })
  );

  await page.goto("/shifts");
  await openAssistantAndAsk(page, "¿Camila está verificada?");

  await expect(
    page.getByText("Sí, Camila Duarte tiene la identidad verificada.")
  ).toBeVisible();
  await expect(page).toHaveURL("/assistant");
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
  await expect(page).toHaveURL("/assistant");
});

test("varias preguntas seguidas quedan en el historial de la misma visita", async ({ page }) => {
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
          query_summary: "No tenés turnos para hoy.",
          query_count: 0,
          query_tab: "todos",
        })
      ),
    })
  );

  await page.goto("/shifts");
  await openAssistantAndAsk(page, "¿qué tengo hoy?");
  await expect(page.getByText("No tenés turnos para hoy.")).toBeVisible();

  // El campo se limpia solo para la próxima pregunta, sin perder la anterior.
  await page
    .getByPlaceholder("Ej: necesito un mozo el sábado a la noche, se paga 45000")
    .fill("¿y mañana?");
  await page.getByRole("button", { name: "Completar" }).click();

  await expect(page.getByText("¿qué tengo hoy?")).toBeVisible();
  await expect(page.getByText("¿y mañana?")).toBeVisible();
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

test("el botón flotante no aparece en /assistant (ya estás ahí)", async ({ page }) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockSession(page, EMPLOYER_SESSION);

  await page.goto("/assistant");
  await expect(page.getByRole("button", { name: "Asistente de turnos con IA" })).toHaveCount(0);
});

test("el botón flotante SÍ aparece para un trabajador y lleva a su propio asistente", async ({
  page,
}) => {
  // Antes se ocultaba del todo para cualquier rol que no fuera comercio —
  // pedido de Julieta: "el asistente de ia falta para el trabajador".
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockSession(page, WORKER_SESSION);
  await page.route("**/api/v1/shifts**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/v1/applications/mine", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/v1/workers/me/profile", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  );

  await page.goto("/feed");
  const fab = page.getByRole("button", { name: "Asistente de turnos con IA" });
  await expect(fab).toBeVisible();
  await fab.click();
  await expect(page).toHaveURL("/assistant");
  await expect(
    page.getByText("Contame qué turno buscás — puesto, zona, a cuántos kilómetros y para cuándo.")
  ).toBeVisible();
});

test("un admin que entra a /assistant por URL directa se va a su panel", async ({ page }) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockSession(page, {
    ...WORKER_SESSION,
    id: "user-3",
    email: "admin.demo@staffya.com",
    role: "admin",
  });
  await page.route("**/api/v1/admin/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  await page.goto("/assistant");
  await expect(page).toHaveURL("/admin");
});

test("buscar_turnos: el trabajador pide un turno por zona/radio/fecha y el asistente arma la búsqueda", async ({
  page,
}) => {
  // Caso real reportado por Julieta: "búscame un turno en palermo a menos
  // de 2 kilómetros para hoy tanto para mozo barista y cajero".
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockSession(page, WORKER_SESSION);

  let requestBody: Record<string, unknown> | null = null;
  await page.route("**/api/v1/assistant/worker-query", (route) => {
    requestBody = route.request().postDataJSON();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        intent: "buscar_turnos",
        message: null,
        positions: ["mozo", "barista", "cajero"],
        zone_name: "Palermo",
        radius_km: 2,
        date_filter: "hoy",
      }),
    });
  });

  await page.goto("/assistant");
  await page
    .getByPlaceholder("Ej: buscame un turno de mozo en Palermo a menos de 2 km para hoy")
    .fill("búscame un turno en palermo a menos de 2 kilómetros para hoy tanto para mozo barista y cajero");
  await page.getByRole("button", { name: "Completar" }).click();

  expect(requestBody).not.toBeNull();
  await expect(page.getByText(/Mozo\/a, Barista, Cajero\/a en Palermo/)).toBeVisible();
  const verTurnos = page.getByRole("button", { name: "Ver turnos" });
  await expect(verTurnos).toBeVisible();

  await page.route("**/api/v1/shifts/feed**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/v1/applications/mine", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/v1/workers/me/profile", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  );

  await verTurnos.click();
  await expect(page).toHaveURL(/\/feed\?.*zoneName=Palermo/);
  await expect(page.getByText("Turnos que buscaste en")).toBeVisible();
  await expect(page.getByText("Palermo")).toBeVisible();
});
