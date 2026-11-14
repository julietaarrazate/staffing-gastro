import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * Segundo toque, segunda parte (G2, U006–U008): un doble toque separado por
 * 700 ms (lo que tarda la gente en volver a tocar porque «no pasó nada») no
 * dispara la acción siguiente.
 *
 * 1. Publicar: el segundo toque de «Continuar» cae sobre «Publicar turno».
 * 2. Postularse: el segundo toque de «Postularme» cae sobre la carta que
 *    quedó debajo (mazo mobile) o sobre otra tarjeta (grilla de escritorio).
 * 3. Retirar: «Sí, cancelar» manda un solo pedido.
 *
 * Los toques van por coordenadas: lo que se prueba es qué recibe un dedo que
 * cae en el mismo punto, sea lo que sea que haya ahí.
 */

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

const WORKER_SESSION = {
  id: "user-1",
  email: "demo.mozo.palermo@staffya.com",
  full_name: "Mozo Demo",
  role: "worker",
  status: "activo",
  is_active: true,
  is_verified: true,
};

const WORKER_PROFILE = {
  id: "profile-1",
  user_id: "user-1",
  full_name: "Mozo Demo",
  photo_url: null,
  birth_date: null,
  age: null,
  city: "Palermo, CABA",
  bio: null,
  latitude: -34.5875,
  longitude: -58.4257,
  skills: ["mozo"],
  years_experience: 2,
  languages: [],
  certifications: [],
  cv_url: null,
  is_available: true,
  rating: 4.8,
  events_completed: 10,
  punctuality_rate: 0.95,
  cancellations: 0,
  badges: [],
  level: "plata",
};

function shift(id: string, company: string) {
  return {
    id,
    company_id: `company-${id}`,
    position: "mozo",
    quantity: 1,
    start_at: "2026-07-10T20:00:00-03:00",
    end_at: "2026-07-10T23:00:00-03:00",
    pay_amount: "15000",
    currency: "ARS",
    tips: true,
    meal: false,
    dress_code: null,
    urgent: false,
    address: null,
    city: "Palermo, CABA",
    latitude: -34.5875,
    longitude: -58.4257,
    title: null,
    description: null,
    status: "publicado",
    worker_profile_id: null,
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
    created_at: "2026-07-01T12:00:00-03:00",
    company_name: company,
    company_logo_url: null,
    company_verified: false,
  };
}

async function centro(page: Page, selector: ReturnType<Page["getByRole"]>) {
  const box = await selector.boundingBox();
  if (!box) throw new Error("el botón no tiene caja");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function prepararTrabajador(page: Page) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) => route.fulfill(json(WORKER_SESSION)));
  await page.route("**/api/v1/workers/me/profile", (route) => route.fulfill(json(WORKER_PROFILE)));
  await page.route("**/api/v1/shifts/mine", (route) => route.fulfill(json([])));
  await page.route("**/api/v1/saved-shifts", (route) => route.fulfill(json([])));
  await page.route("**/api/v1/saved-shifts/ids", (route) => route.fulfill(json({ shift_ids: [] })));
}

test("publicar: el segundo toque de «Continuar» no publica el turno", async ({ page }) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill(
      json({
        id: "user-2",
        email: "demo.palermo@staffya.com",
        full_name: "Comercio Demo",
        role: "employer",
        status: "activo",
        is_active: true,
        is_verified: true,
      })
    )
  );
  const pedidos = { crear: 0, publicar: 0 };
  await page.route("**/api/v1/shifts", (route) => {
    if (route.request().method() !== "POST") return route.continue();
    pedidos.crear += 1;
    return route.fulfill(json({ id: "shift-new-1" }, 201));
  });
  await page.route("**/api/v1/shifts/shift-new-1/publish", (route) => {
    pedidos.publicar += 1;
    return route.fulfill(json({}));
  });
  await page.route("**/api/v1/shifts/me", (route) => route.fulfill(json([])));

  await page.goto("/shifts/new");
  await page.getByRole("button", { name: "Mozo/a" }).click();
  await page.locator('input[type="datetime-local"]').first().fill("2026-07-15T20:00");
  await page.locator('input[type="datetime-local"]').nth(1).fill("2026-07-15T23:00");
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByPlaceholder("48000").fill("15000");
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.locator("select").nth(1).selectOption("Palermo");
  await expect(page.getByRole("button", { name: "Publicar turno" })).toBeEnabled();

  // Vuelve al paso del pago, con todo lo cargado, y toca «Continuar» dos veces.
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Atrás" }).click();
  await expect(page.getByPlaceholder("48000")).toBeVisible();
  await page.waitForTimeout(1200);
  const { x, y } = await centro(page, page.getByRole("button", { name: "Continuar" }));
  await page.mouse.click(x, y);
  await expect(page.getByText("Publicar turno")).toBeVisible();
  await page.waitForTimeout(700);
  await page.mouse.click(x, y);
  await page.waitForTimeout(500);
  expect(pedidos).toEqual({ crear: 0, publicar: 0 });
  await expect(page.getByText("¡Turno publicado!")).toHaveCount(0);

  // Con la pantalla asentada, «Publicar turno» sí publica.
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Publicar turno" }).click();
  await expect(page.getByText("¡Turno publicado!")).toBeVisible();
  expect(pedidos).toEqual({ crear: 1, publicar: 1 });
});

test("postularse en el mazo: el segundo toque no postula la carta de abajo", async ({ page }) => {
  await prepararTrabajador(page);
  const postuladas: string[] = [];
  await page.route(/\/api\/v1\/shifts\/feed(\?.*)?$/, (route) =>
    route.fulfill(json([shift("shift-1", "Bar Uno"), shift("shift-2", "Bar Dos")]))
  );
  await page.route(/\/api\/v1\/applications\/mine(\?.*)?$/, (route) => route.fulfill(json([])));
  await page.route("**/api/v1/applications/shifts/*", (route) => {
    if (route.request().method() !== "POST") return route.continue();
    postuladas.push(route.request().url().split("/").pop() ?? "");
    return route.fulfill(
      json(
        { id: "app-x", shift_id: "x", worker_profile_id: "profile-1", status: "pendiente", created_at: "2026-07-02T10:00:00-03:00" },
        201
      )
    );
  });

  await page.goto("/feed");
  await page.getByRole("button", { name: /Descubrir rápido/ }).click();
  const deck = page.getByRole("dialog", { name: "Descubrir rápido" });
  await expect(deck.getByTestId("swipe-deck-position")).toHaveText("1 de 2");
  const { x, y } = await centro(page, deck.getByRole("button", { name: "Postularme" }));
  await page.mouse.click(x, y);
  await expect(deck.getByTestId("swipe-deck-position")).toHaveText("1 de 1");
  await page.waitForTimeout(700);
  await page.mouse.click(x, y);
  await page.waitForTimeout(500);
  expect(postuladas).toEqual(["shift-1"]);
  await expect(deck.getByTestId("swipe-deck-position")).toHaveText("1 de 1");
});

test("postularse en la grilla: la tarjeta queda en su lugar, «Postulado», y un segundo toque no postula otra", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1400 });
  await prepararTrabajador(page);
  const postuladas: string[] = [];
  await page.route(/\/api\/v1\/shifts\/feed(\?.*)?$/, (route) =>
    route.fulfill(json([shift("shift-1", "Bar Uno"), shift("shift-2", "Bar Dos")]))
  );
  await page.route(/\/api\/v1\/applications\/mine(\?.*)?$/, (route) => route.fulfill(json([])));
  await page.route("**/api/v1/applications/shifts/*", (route) => {
    if (route.request().method() !== "POST") return route.continue();
    postuladas.push(route.request().url().split("/").pop() ?? "");
    return route.fulfill(
      json(
        { id: "app-x", shift_id: "x", worker_profile_id: "profile-1", status: "pendiente", created_at: "2026-07-02T10:00:00-03:00" },
        201
      )
    );
  });

  await page.goto("/feed");
  const cards = page.getByTestId("feed-grid-card");
  await expect(cards).toHaveCount(2);
  const primera = cards.first();
  const { x, y } = await centro(page, primera.getByRole("button", { name: "Postularme" }));
  await page.mouse.click(x, y);
  await expect(primera.getByText("Postulado")).toBeVisible();
  await expect(cards).toHaveCount(2);
  await page.waitForTimeout(700);
  await page.mouse.click(x, y);
  await page.waitForTimeout(500);
  expect(postuladas).toEqual(["shift-1"]);
  await expect(cards.nth(1).getByRole("button", { name: "Postularme" })).toBeEnabled();
});

const APPS = () => [
  { id: "app-1", shift_id: "shift-1", worker_profile_id: "profile-1", status: "pendiente", created_at: "2026-07-02T10:00:00-03:00", shift: shift("shift-1", "Bar Uno") },
  { id: "app-2", shift_id: "shift-2", worker_profile_id: "profile-1", status: "pendiente", created_at: "2026-07-02T10:00:00-03:00", shift: shift("shift-2", "Bar Dos") },
];

async function abrirRetiro(page: Page) {
  await page.goto("/my-shifts");
  await page.getByRole("button", { name: "Postulaciones (2)" }).click();
  await page.getByRole("button", { name: "Cancelar postulación" }).first().click();
  const dialog = page.getByRole("dialog", { name: "¿Cancelar tu postulación?" });
  await expect(dialog.getByRole("button", { name: "Sí, cancelar" })).toBeEnabled();
  return dialog;
}

test("un diálogo que se cierra se traga el toque: la pantalla de atrás no lo recibe", async ({ page }) => {
  await prepararTrabajador(page);
  await page.route(/\/api\/v1\/applications\/mine(\?.*)?$/, (route) => route.fulfill(json(APPS())));
  const dialog = await abrirRetiro(page);
  const { x, y } = await centro(page, dialog.getByRole("button", { name: "Volver" }));
  // Un botón de la pantalla de atrás, justo bajo «Volver» (el diálogo está encima, z-[60]).
  await page.evaluate(([cx, cy]) => {
    const b = document.createElement("button");
    b.id = "sonda";
    b.style.cssText = `position:fixed;left:${cx - 40}px;top:${cy - 20}px;width:80px;height:40px;z-index:1`;
    (window as unknown as { __sonda: number }).__sonda = 0;
    b.addEventListener("click", () => ((window as unknown as { __sonda: number }).__sonda += 1));
    document.body.appendChild(b);
  }, [x, y]);
  // Doble toque seguido: el primero cierra, el segundo cae mientras el diálogo sale.
  await page.mouse.click(x, y);
  await page.mouse.click(x, y);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __sonda: number }).__sonda)).toBe(0);
});

test("retirar: si el servidor dice que ya no estaba pendiente (400), no vuelve a mostrarla y recarga", async ({ page }) => {
  await prepararTrabajador(page);
  let cargas = 0;
  let retirada = false;
  await page.route(/\/api\/v1\/applications\/mine(\?.*)?$/, (route) => {
    cargas += 1;
    return route.fulfill(json(APPS().filter((a) => !(retirada && a.id === "app-1"))));
  });
  await page.route("**/api/v1/applications/app-1/withdraw", (route) => {
    retirada = true; // se retiró desde otro lado
    return route.fulfill(json({ detail: "Ya estaba retirada" }, 400));
  });
  const dialog = await abrirRetiro(page);
  const antes = cargas;
  await dialog.getByRole("button", { name: "Sí, cancelar" }).click();
  await expect(page.getByText("Ya estaba retirada")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancelar postulación" })).toHaveCount(1);
  await expect.poll(() => cargas).toBeGreaterThan(antes);
  await expect(page.getByText("Bar Uno")).toHaveCount(0);
});

test("retirar: con otro error la postulación vuelve a su lugar, no al principio", async ({ page }) => {
  await prepararTrabajador(page);
  await page.route(/\/api\/v1\/applications\/mine(\?.*)?$/, (route) => route.fulfill(json(APPS())));
  await page.route("**/api/v1/applications/app-2/withdraw", (route) =>
    route.fulfill(json({ detail: "Error del servidor" }, 500))
  );
  await page.goto("/my-shifts");
  await page.getByRole("button", { name: "Postulaciones (2)" }).click();
  await page.getByRole("button", { name: "Cancelar postulación" }).nth(1).click();
  const dialog = page.getByRole("dialog", { name: "¿Cancelar tu postulación?" });
  await expect(dialog.getByRole("button", { name: "Sí, cancelar" })).toBeEnabled();
  await dialog.getByRole("button", { name: "Sí, cancelar" }).click();
  await expect(page.getByText("Error del servidor")).toBeVisible();
  const empresas = page.locator("text=/^Bar (Uno|Dos)$/");
  await expect(empresas).toHaveCount(2);
  await expect(empresas.nth(0)).toHaveText("Bar Uno");
  await expect(empresas.nth(1)).toHaveText("Bar Dos");
});
