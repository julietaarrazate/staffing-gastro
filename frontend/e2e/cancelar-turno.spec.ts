import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * Cancelar un turno (T3e): la confirmación del panel dice a quién se le avisa
 * y, sólo cuando aplica, que suma una cancelación tardía (ADR-0007: cancelar
 * con el trabajador ya confirmado). Después el comercio ve la cuenta en su
 * perfil, y el trabajador llega desde el aviso a una pantalla que sirve.
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

const WORKER_SESSION = { ...EMPLOYER_SESSION, id: "user-2", role: "worker", full_name: "Ana Gomez" };

const LATE_WARNING = "Te suma una cancelación tardía. La ves en tu perfil.";

function shift(overrides: Partial<Record<string, unknown>>) {
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
    address: null,
    city: "Palermo, CABA",
    latitude: null,
    longitude: null,
    title: null,
    description: null,
    status: "confirmado",
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
    ...overrides,
  };
}

const json = (body: unknown) => ({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify(body),
});

type MockShift = ReturnType<typeof shift>;

/**
 * Panel del comercio con un solo turno. `listed` es lo que trae la lista al
 * entrar (`GET /shifts/me`) y `server` lo que el servidor tiene ahora, que es
 * lo que contesta la relectura al abrir el diálogo (`GET /shifts/{id}`): por
 * defecto son iguales. Devuelve los `POST /cancel` recibidos.
 */
async function mockPanel(
  page: Page,
  listed: MockShift,
  {
    server = listed,
    rereadFails = false,
    rereadDelayMs = 0,
  }: { server?: MockShift; rereadFails?: boolean; rereadDelayMs?: number } = {}
): Promise<string[]> {
  const current = { ...server };
  const cancelCalls: string[] = [];
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) => route.fulfill(json(EMPLOYER_SESSION)));
  await page.route("**/api/v1/reviews/shifts/*", (route) => route.fulfill(json([])));
  // La lista deja de ser vieja después de cancelar (el panel la recarga).
  await page.route("**/api/v1/shifts/me", (route) =>
    route.fulfill(json([cancelCalls.length > 0 ? current : listed]))
  );
  // El detalle no trae `worker_name` y sí los datos del comercio, como el real.
  await page.route(/\/api\/v1\/shifts\/shift-1$/, async (route) => {
    if (rereadDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, rereadDelayMs));
    if (rereadFails) return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
    return route.fulfill(json({ ...current, worker_name: undefined, company_name: "Bar Palermo" }));
  });
  await page.route(/\/api\/v1\/shifts\/[^/]+\/cancel$/, async (route) => {
    cancelCalls.push(new URL(route.request().url()).pathname);
    current.status = "cancelado";
    await route.fulfill(json(current));
  });
  return cancelCalls;
}

async function openCancelDialog(page: Page, { waitForText = true } = {}) {
  await page.goto("/shifts");
  await page.getByRole("button", { name: "Más acciones" }).click();
  await page
    .getByRole("dialog", { name: "Más acciones" })
    .getByRole("button", { name: "Cancelar turno" })
    .click();
  const dialog = page.getByRole("dialog", { name: "¿Cancelar este turno?" });
  await expect(dialog).toBeVisible();
  // El texto aparece cuando terminó la relectura del turno.
  if (waitForText) await expect(dialog.getByTestId("cancel-checking")).toHaveCount(0);
  return dialog;
}

const ASSIGNED_TEXT =
  "Ya tenés un trabajador asignado: se le avisa que el turno se cancela y no vas a poder deshacerlo.";
const CONFIRMED_TEXT =
  "El trabajador ya confirmó: se le avisa que el turno se cancela y no vas a poder deshacerlo.";
const OPEN_TEXT =
  "El turno deja de estar disponible para postularse. Si alguien se postuló, se le avisa. No vas a poder deshacerlo.";

// --- El texto sale del estado de AHORA, no del de la lista cargada -----------

test("lista vieja «asignado» y el trabajador ya confirmó: avisa la cancelación tardía", async ({
  page,
}) => {
  const cancelCalls = await mockPanel(page, shift({ status: "asignado" }), {
    server: shift({ status: "confirmado" }),
  });
  const dialog = await openCancelDialog(page);

  await expect(dialog.getByText(CONFIRMED_TEXT)).toBeVisible();
  await expect(dialog.getByText(LATE_WARNING)).toBeVisible();
  await expect(dialog.getByText(ASSIGNED_TEXT)).toHaveCount(0);
  expect(cancelCalls).toEqual([]);

  // La tarjeta de atrás también quedó al día, con el nombre que ya tenía.
  await dialog.getByRole("button", { name: "Volver" }).click();
  const card = page.locator('[data-testid="shift-card"][data-shift-id="shift-1"]');
  await expect(card.getByText("Confirmado", { exact: true })).toBeVisible();
  await expect(card.getByText("Bar Palermo")).toHaveCount(0);
});

test("lista vieja «confirmado» y el trabajador se bajó: no promete una cancelación tardía", async ({
  page,
}) => {
  await mockPanel(page, shift({ status: "confirmado" }), {
    server: shift({ status: "buscando_personal", worker_profile_id: null, worker_name: null }),
  });
  const dialog = await openCancelDialog(page);

  await expect(dialog.getByText(OPEN_TEXT)).toBeVisible();
  await expect(dialog.getByText("cancelación tardía")).toHaveCount(0);
  await expect(dialog.getByText(CONFIRMED_TEXT)).toHaveCount(0);
});

test("mientras se relee el turno, el «Sí» está apagado y no se ve el texto viejo", async ({
  page,
}) => {
  const cancelCalls = await mockPanel(page, shift({ status: "asignado" }), {
    server: shift({ status: "confirmado" }),
    rereadDelayMs: 1500,
  });
  const dialog = await openCancelDialog(page, { waitForText: false });
  const confirm = dialog.getByRole("button", { name: "Sí, cancelar turno" });

  await expect(dialog.getByTestId("cancel-checking")).toBeVisible();
  await expect(confirm).toBeDisabled();
  // Ni el texto del estado viejo ni el nuevo: nada que después cambie.
  await expect(dialog.getByText(ASSIGNED_TEXT)).toHaveCount(0);
  await expect(dialog.getByText(LATE_WARNING)).toHaveCount(0);

  await expect(dialog.getByText(LATE_WARNING)).toBeVisible();
  await expect(confirm).toBeEnabled();
  expect(cancelCalls).toEqual([]);
});

test("si la relectura falla, vale el estado conocido y se puede cancelar igual", async ({
  page,
}) => {
  const cancelCalls = await mockPanel(page, shift({ status: "asignado" }), { rereadFails: true });
  const dialog = await openCancelDialog(page);

  await expect(dialog.getByText(ASSIGNED_TEXT)).toBeVisible();
  await expect(dialog.getByText("cancelación tardía")).toHaveCount(0);

  await dialog.getByRole("button", { name: "Sí, cancelar turno" }).click();
  await expect.poll(() => cancelCalls).toEqual(["/api/v1/shifts/shift-1/cancel"]);
});

test("si el turno ya terminó, el diálogo se cierra y la tarjeta queda al día", async ({ page }) => {
  const cancelCalls = await mockPanel(page, shift({ status: "check_out" }), {
    server: shift({ status: "finalizado" }),
  });
  await page.goto("/shifts");
  await page.getByRole("button", { name: "Más acciones" }).click();
  await page
    .getByRole("dialog", { name: "Más acciones" })
    .getByRole("button", { name: "Cancelar turno" })
    .click();

  await expect(page.getByText("Este turno ya no se puede cancelar.")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "¿Cancelar este turno?" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Marcar como pagado" })).toBeVisible();
  expect(cancelCalls).toEqual([]);
});

for (const status of ["confirmado", "check_in"]) {
  test(`turno ${status}: la confirmación avisa la cancelación tardía antes de cancelar`, async ({
    page,
  }) => {
    const cancelCalls = await mockPanel(page, shift({ status }));
    const dialog = await openCancelDialog(page);

    await expect(dialog.getByText(LATE_WARNING)).toBeVisible();
    await expect(dialog.getByText(CONFIRMED_TEXT)).toBeVisible();
    // Lo dice ANTES: hasta el «Sí» no salió ningún pedido.
    expect(cancelCalls).toEqual([]);

    await dialog.getByRole("button", { name: "Sí, cancelar turno" }).click();
    await expect.poll(() => cancelCalls).toEqual(["/api/v1/shifts/shift-1/cancel"]);
  });
}

test("«Volver» no cancela nada", async ({ page }) => {
  const cancelCalls = await mockPanel(page, shift({ status: "confirmado" }));
  const dialog = await openCancelDialog(page);

  await dialog.getByRole("button", { name: "Volver" }).click();

  await expect(dialog).toBeHidden();
  expect(cancelCalls).toEqual([]);
});

test("turno asignado sin confirmar: se le avisa al trabajador, sin cancelación tardía", async ({
  page,
}) => {
  await mockPanel(page, shift({ status: "asignado" }));
  const dialog = await openCancelDialog(page);

  await expect(dialog.getByText(ASSIGNED_TEXT)).toBeVisible();
  await expect(dialog.getByText("cancelación tardía")).toHaveCount(0);
});

test("turno buscando personal: se avisa a quien se postuló, sin cancelación tardía", async ({
  page,
}) => {
  await mockPanel(
    page,
    shift({ status: "buscando_personal", worker_profile_id: null, worker_name: null })
  );
  const dialog = await openCancelDialog(page);

  await expect(dialog.getByText(OPEN_TEXT)).toBeVisible();
  await expect(dialog.getByText("cancelación tardía")).toHaveCount(0);
});

// --- El comercio ve cuántas tiene, en su perfil ------------------------------

const COMPANY_PROFILE = {
  id: "company-1",
  user_id: "user-1",
  owner_full_name: "Comercio Demo",
  name: "Bar Palermo",
  logo_url: null,
  cover_photo_url: null,
  category: "bar",
  description: null,
  address: null,
  city: "Palermo, CABA",
  latitude: null,
  longitude: null,
  capacity: null,
  opening_hours: null,
  rating: 0,
  events_published: 4,
  on_time_payment_rate: 0,
  late_cancellations: 0,
  created_at: "2026-10-01T12:00:00-03:00",
};

async function mockEmployerProfile(page: Page, lateCancellations: number) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) => route.fulfill(json(EMPLOYER_SESSION)));
  await page.route("**/api/v1/companies/me/profile", (route) =>
    route.fulfill(json({ ...COMPANY_PROFILE, late_cancellations: lateCancellations }))
  );
  await page.route("**/api/v1/reviews/received", (route) => route.fulfill(json([])));
  await page.route("**/api/v1/identity/me", (route) => route.fulfill(json({ claims: [] })));
}

test("el perfil del comercio muestra cuántas cancelaciones tardías tiene", async ({ page }) => {
  await mockEmployerProfile(page, 2);
  await page.goto("/profile");

  const block = page.getByRole("region", { name: "Cancelaciones tardías" });
  await expect(block).toBeVisible();
  await expect(block.getByText("2", { exact: true })).toBeVisible();
  await expect(
    block.getByText("Turnos que cancelaste con el trabajador ya confirmado.")
  ).toBeVisible();
});

test("con una sola, va en singular", async ({ page }) => {
  await mockEmployerProfile(page, 1);
  await page.goto("/profile");

  const block = page.getByRole("region", { name: "Cancelaciones tardías" });
  await expect(block.getByText("Cancelación tardía", { exact: true })).toBeVisible();
});

test("sin cancelaciones tardías, el perfil no muestra nada en cero", async ({ page }) => {
  await mockEmployerProfile(page, 0);
  // Se espera la respuesta del perfil: sin esto el test pasaría igual con el
  // dato todavía en viaje.
  const loaded = page.waitForResponse("**/api/v1/companies/me/profile");
  await page.goto("/profile");
  await loaded;

  await expect(page.getByRole("link", { name: "Datos del comercio" })).toBeVisible();
  await expect(page.getByText(/cancelaci(ón|ones) tardía/i)).toHaveCount(0);
});

// --- El aviso lleva al trabajador a una pantalla que sirve -------------------

function notice(type: string, title: string, message: string) {
  return {
    id: `n-${type}`,
    type,
    title,
    message,
    read: false,
    link: null,
    created_at: "2026-12-10T12:00:00-03:00",
  };
}

async function mockWorkerWithNotice(page: Page, item: ReturnType<typeof notice>) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await page.route("**/api/v1/auth/me", (route) => route.fulfill(json(WORKER_SESSION)));
  await page.route("**/api/v1/notifications", (route) => route.fulfill(json([item])));
  await page.route("**/api/v1/notifications/*/read", (route) =>
    route.fulfill(json({ ...item, read: true }))
  );
  // Lo que piden las pantallas de destino: vacío alcanza, se mira la URL.
  for (const path of ["shifts/mine", "shifts/feed*", "applications/mine*", "saved-shifts"]) {
    await page.route(`**/api/v1/${path}`, (route) => route.fulfill(json([])));
  }
}

test("el aviso al postulante se lee en la campanita y abre el Inicio", async ({ page }) => {
  await mockWorkerWithNotice(
    page,
    notice(
      "applied_shift_cancelled",
      "Se canceló un turno al que te postulaste",
      'El comercio canceló "Mozo para el sábado". Tu postulación quedó sin efecto: mirá otros turnos cerca.'
    )
  );
  await page.goto("/my-shifts");

  await page.getByRole("button", { name: "Notificaciones" }).click();
  await page.getByRole("button", { name: /Se canceló un turno al que te postulaste/ }).click();

  await expect(page).toHaveURL(/\/feed$/);
});

test("el aviso al asignado sin confirmar abre «Mis turnos»", async ({ page }) => {
  await mockWorkerWithNotice(
    page,
    notice(
      "shift_cancelled",
      "El comercio canceló el turno",
      '"Mozo para el sábado" se canceló antes de que confirmaras. Ya no tenés que responder.'
    )
  );
  await page.goto("/feed");

  await page.getByRole("button", { name: "Notificaciones" }).click();
  await page.getByRole("button", { name: /El comercio canceló el turno/ }).click();

  await expect(page).toHaveURL(/\/my-shifts$/);
});
