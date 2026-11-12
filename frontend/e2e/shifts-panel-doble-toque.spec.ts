import { test, expect, type Locator, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * Panel del comercio (`/shifts`): un toque de más nunca registra un pago ni
 * cierra otro turno.
 *
 * El botón principal de la tarjeta ocupa siempre el mismo lugar y cambia con
 * el estado del turno («Cerrar turno» → «Marcar como pagado»). Lo que tiene
 * que pasar:
 *
 * 1. Después de «Cerrar turno», un segundo toque en el mismo lugar no hace
 *    nada: ni sobre el botón nuevo de esa tarjeta, ni sobre el de la tarjeta
 *    que subió a ocupar ese lugar (`lib/use-tap-guard.ts`).
 * 2. «Marcar como pagado» pide confirmación: avisa al trabajador que cobró y
 *    no se puede deshacer, así que el pedido sale recién con el «Sí».
 *
 * Los toques van por coordenadas (`page.mouse.click`) y no por el nombre del
 * botón: lo que se prueba es qué recibe un dedo que cae en el mismo punto de
 * la pantalla, sea lo que sea que haya ahí en ese momento.
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

type MockShift = ReturnType<typeof shift>;

function shift(overrides: Partial<Record<string, unknown>>) {
  return {
    id: "shift-base",
    company_id: "company-1",
    position: "mozo",
    quantity: 1,
    start_at: "2026-07-20T20:00:00-03:00",
    end_at: "2026-07-20T23:00:00-03:00",
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
    status: "check_out",
    worker_profile_id: "wp-1",
    worker_name: "Trabajador Demo",
    check_in_latitude: null,
    check_in_longitude: null,
    check_in_at: null,
    check_out_latitude: null,
    check_out_longitude: null,
    check_out_at: null,
    paid_at: null,
    created_at: "2026-07-01T12:00:00-03:00",
    company_name: null,
    company_logo_url: null,
    ...overrides,
  };
}

interface Call {
  action: "finish" | "mark-paid";
  id: string;
}

/**
 * API simulada con estado: `finish` y `mark-paid` cambian el turno, y el
 * `GET /shifts/me` siguiente lo devuelve ya cambiado (así la lista se
 * redibuja como en la app real). Devuelve los pedidos de acción recibidos.
 */
async function mockPanel(
  page: Page,
  initial: MockShift[],
  { actionDelayMs = 0 }: { actionDelayMs?: number } = {}
): Promise<Call[]> {
  const shifts = initial.map((s) => ({ ...s }));
  const calls: Call[] = [];
  const json = (body: unknown) => ({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

  await injectSession(page);
  // La splash de marca tapa la pantalla ~1 s: con ella encima, un toque por
  // coordenadas le pega a la splash y no al botón.
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) => route.fulfill(json(EMPLOYER_SESSION)));
  await page.route("**/api/v1/reviews/shifts/*", (route) => route.fulfill(json([])));
  await page.route("**/api/v1/shifts/me", (route) => route.fulfill(json(shifts)));
  await page.route(/\/api\/v1\/shifts\/[^/]+\/(finish|mark-paid)$/, async (route) => {
    const [, id, action] =
      new URL(route.request().url()).pathname.match(/\/shifts\/([^/]+)\/(finish|mark-paid)$/) ?? [];
    calls.push({ action: action as Call["action"], id });
    const target = shifts.find((s) => s.id === id);
    if (target) target.status = action === "finish" ? "finalizado" : "pagado";
    if (actionDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, actionDelayMs));
    await route.fulfill(json(target ?? {}));
  });

  return calls;
}

function card(page: Page, id: string): Locator {
  return page.locator(`[data-testid="shift-card"][data-shift-id="${id}"]`);
}

/** Centro del elemento en coordenadas de pantalla: «el mismo lugar» del dedo. */
async function centerOf(locator: Locator): Promise<{ x: number; y: number }> {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error("El elemento no está en pantalla");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

const dialog = (page: Page) => page.getByRole("dialog", { name: "¿Ya le pagaste este turno?" });

// Los dos ritmos de un segundo toque: el doble toque casi pegado y el de
// quien vuelve a tocar porque «no pasó nada».
for (const gapMs of [120, 700]) {
  test(`dos toques sobre «Cerrar turno» separados ${gapMs} ms cierran el turno una sola vez y no lo marcan pagado`, async ({
    page,
  }) => {
    const calls = await mockPanel(page, [shift({ id: "turno-a" })]);
    await page.goto("/shifts");

    const point = await centerOf(card(page, "turno-a").getByRole("button", { name: "Cerrar turno" }));
    await page.mouse.click(point.x, point.y);
    await page.waitForTimeout(gapMs);
    await page.mouse.click(point.x, point.y);

    // El turno quedó cerrado y a la espera de que el comercio registre el pago…
    await expect(card(page, "turno-a")).toContainText("Falta registrar el pago.");
    // …y cuando la pantalla termina de asentarse el botón nuevo queda listo.
    await expect(
      card(page, "turno-a").getByRole("button", { name: "Marcar como pagado" })
    ).toBeEnabled();

    expect(calls).toEqual([{ action: "finish", id: "turno-a" }]);
    await expect(dialog(page)).toHaveCount(0);
    await expect(card(page, "turno-a")).not.toContainText("Listo: trabajado y pagado.");
  });

  test(`con dos turnos por cerrar, dos toques separados ${gapMs} ms cierran sólo el que se tocó`, async ({
    page,
  }) => {
    const calls = await mockPanel(page, [shift({ id: "turno-a" }), shift({ id: "turno-b" })]);
    await page.goto("/shifts");

    const point = await centerOf(card(page, "turno-a").getByRole("button", { name: "Cerrar turno" }));
    await page.mouse.click(point.x, point.y);
    await page.waitForTimeout(gapMs);
    await page.mouse.click(point.x, point.y);

    await expect(card(page, "turno-a")).toContainText("Falta registrar el pago.");
    // El otro turno sigue esperando su propio cierre, y se puede cerrar a
    // propósito apenas la pantalla se asienta: la guarda no deja nada trabado.
    const closeB = card(page, "turno-b").getByRole("button", { name: "Cerrar turno" });
    await expect(closeB).toBeEnabled();
    expect(calls).toEqual([{ action: "finish", id: "turno-a" }]);

    await closeB.click();
    await expect(card(page, "turno-b")).toContainText("Falta registrar el pago.");
    expect(calls).toEqual([
      { action: "finish", id: "turno-a" },
      { action: "finish", id: "turno-b" },
    ]);
  });
}

test("con la conexión lenta, seguir tocando mientras carga y cuando vuelve la tarjeta no registra el pago", async ({
  page,
}) => {
  const calls = await mockPanel(page, [shift({ id: "turno-a" })], { actionDelayMs: 400 });
  await page.goto("/shifts");

  const point = await centerOf(card(page, "turno-a").getByRole("button", { name: "Cerrar turno" }));
  // Un toque cada 150 ms durante ~0,9 s: los primeros caen con el botón
  // cargando y los últimos, con la tarjeta recién redibujada.
  for (let i = 0; i < 7; i += 1) {
    await page.mouse.click(point.x, point.y);
    await page.waitForTimeout(150);
  }

  await expect(card(page, "turno-a")).toContainText("Falta registrar el pago.");
  await expect(card(page, "turno-a").getByRole("button", { name: "Marcar como pagado" })).toBeEnabled();
  expect(calls).toEqual([{ action: "finish", id: "turno-a" }]);
  await expect(dialog(page)).toHaveCount(0);
});

test("«Marcar como pagado» pide confirmación y recién el «Sí» registra el pago", async ({ page }) => {
  const calls = await mockPanel(page, [shift({ id: "turno-a", status: "finalizado" })]);
  await page.goto("/shifts");

  const markPaid = card(page, "turno-a").getByRole("button", { name: "Marcar como pagado" });
  await markPaid.click();

  // El diálogo dice las dos cosas que el comercio tiene que saber antes.
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page)).toContainText("Se le avisa a Trabajador Demo que ya cobró este turno");
  await expect(dialog(page)).toContainText("no vas a poder deshacerlo");
  expect(calls).toEqual([]);

  // «Volver» no registra nada y deja el turno como estaba.
  await dialog(page).getByRole("button", { name: "Volver" }).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(calls).toEqual([]);
  await expect(card(page, "turno-a")).toContainText("Falta registrar el pago.");

  // Con el «Sí» sale un único pedido y el turno queda pagado.
  await markPaid.click();
  await dialog(page).getByRole("button", { name: "Sí, ya le pagué" }).click();
  await expect(card(page, "turno-a")).toContainText("Listo: trabajado y pagado.");
  expect(calls).toEqual([{ action: "mark-paid", id: "turno-a" }]);
  await expect(dialog(page)).toHaveCount(0);
});

test("un doble toque sobre «Marcar como pagado» deja el diálogo abierto, sin registrar nada", async ({
  page,
}) => {
  const calls = await mockPanel(page, [shift({ id: "turno-a", status: "finalizado" })]);
  await page.goto("/shifts");

  const point = await centerOf(
    card(page, "turno-a").getByRole("button", { name: "Marcar como pagado" })
  );
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(120);
  await page.mouse.click(point.x, point.y);

  // El segundo toque no confirmó ni cerró el diálogo: sigue ahí, esperando
  // una respuesta a propósito, y el «Sí» se habilita enseguida.
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByRole("button", { name: "Sí, ya le pagué" })).toBeEnabled();
  expect(calls).toEqual([]);
  await expect(card(page, "turno-a")).toContainText("Falta registrar el pago.");
});
