import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * Pago de referencia (ADR-0012), las dos caras del mismo cálculo:
 *
 * 1. El comercio, en su panel, ve que su turno paga por debajo de lo habitual
 *    — la causa más común de que no se cubra, que hasta ahora no tenía forma
 *    de conocer. Y sólo mientras todavía puede corregirlo.
 * 2. El trabajador, en el mapa, ve marcado el turno que paga por encima: es el
 *    estado "match" del pin, que quedó declarado y vacío desde el #319.
 *
 * Lo que estos tests protegen no es el estilo sino la REGLA de cuándo aparece
 * cada cosa: mostrar el aviso sobre un turno ya cubierto, o marcar como
 * oportunidad uno que paga lo mismo que el resto, convertiría una señal útil
 * en ruido que la gente aprende a ignorar.
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
  email: "demo.mozo@staffya.com",
  full_name: "Mozo Demo",
  role: "worker",
  status: "activo",
  is_active: true,
  is_verified: true,
};

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
    created_at: "2026-07-01T12:00:00-03:00",
    company_name: null,
    company_logo_url: null,
    company_verified: false,
    pay_band: null,
    ...overrides,
  };
}

async function mockEmployerShifts(page: Page, shifts: unknown[]) {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(EMPLOYER_SESSION),
    })
  );
  await page.route("**/api/v1/shifts/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(shifts) })
  );
}

const AVISO = /Paga por debajo de lo habitual/;

test("el comercio ve por qué su turno no se cubre, y sólo mientras puede corregirlo", async ({
  page,
}) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockEmployerShifts(page, [
    // Paga poco y sigue buscando: es exactamente el momento de avisarle.
    shift({ id: "shift-barato", status: "buscando_personal", pay_band: "por_debajo" }),
    // Pagaba poco, pero ya lo tomaron: el precio funcionó. Avisar ahora sería
    // un reproche inútil sobre algo que ya salió bien.
    shift({
      id: "shift-barato-cubierto",
      status: "confirmado",
      worker_profile_id: "wp-1",
      pay_band: "por_debajo",
    }),
    // Paga en el rango normal: no hay nada que decir.
    shift({ id: "shift-normal", status: "publicado", pay_band: "tipico" }),
  ]);

  await page.goto("/shifts");

  await expect(
    page.locator('[data-shift-id="shift-barato"]').getByText(AVISO)
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page.locator('[data-shift-id="shift-barato-cubierto"]').getByText(AVISO)
  ).toHaveCount(0);
  await expect(page.locator('[data-shift-id="shift-normal"]').getByText(AVISO)).toHaveCount(0);
});

test("sin referencia de mercado no se le dice nada al comercio", async ({ page }) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  // `pay_band: null` es el estado normal al arrancar: todavía no hay muestra
  // suficiente. Preferimos el silencio a inventar una referencia.
  await mockEmployerShifts(page, [
    shift({ id: "shift-sin-dato", status: "buscando_personal", pay_band: null }),
  ]);

  await page.goto("/shifts");

  await expect(page.locator('[data-shift-id="shift-sin-dato"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(AVISO)).toHaveCount(0);
});

test("en el mapa, el turno que paga por encima se distingue del resto", async ({ page }) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(WORKER_SESSION),
    })
  );
  const enElMapa = [
    shift({
      id: "shift-match",
      pay_amount: "40000",
      latitude: -34.5875,
      longitude: -58.4257,
      pay_band: "por_encima",
    }),
    shift({
      id: "shift-comun",
      pay_amount: "15000",
      latitude: -34.589,
      longitude: -58.428,
      pay_band: "tipico",
    }),
  ];
  for (const path of ["**/api/v1/shifts/mine", "**/api/v1/shifts/feed"]) {
    await page.route(path, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(enElMapa) })
    );
  }
  await page.route("**/api/v1/applications/mine", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  await page.goto("/map");

  // La distinción viaja en el nombre accesible, no sólo en el color: un
  // marcador que sólo cambia de tinte no le dice nada a quien usa lector de
  // pantalla (mismo criterio que F4/jsx-a11y en el resto de la app).
  await expect(
    page.getByRole("button", { name: /paga por encima de lo habitual/i })
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: /Turno de .*\$15\.000/ })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /\$15\.000.*paga por encima/i })
  ).toHaveCount(0);
});
