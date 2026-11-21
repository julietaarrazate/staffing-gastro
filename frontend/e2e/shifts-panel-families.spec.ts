import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * Regresión del batch "panel-por-estados" (docs/planning/PULIDO_ROADMAP.md, bug de la
 * operadora: "activos 2 pero abajo la lista completa con inactivos; buscando
 * 1 y no muestra cuál"). Antes había 3 KPIs estáticos (uno en azul,
 * "Buscando" — fuera de la Ley de marca: un solo acento naranja) que no
 * filtraban nada; el panel entero listaba todos los turnos mezclados sin
 * agrupar. Ahora `/shifts` agrupa la lista por familia de estado (Buscando
 * personal / En marcha / Terminados / Cancelados; hasta el 2026-11-21 eran
 * pestañas) y el número de cada título es SIEMPRE el largo real de su grupo —
 * nunca un número desconectado (ese era el bug exacto).
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

function shift(overrides: Partial<Record<string, unknown>>) {
  return {
    id: "shift-base",
    company_id: "company-1",
    position: "mozo",
    quantity: 2,
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
    status: "publicado",
    worker_profile_id: null,
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

// Dos turnos "buscando" (publicado + buscando_personal, misma familia), uno
// "en_marcha" (asignado), uno "terminado" (pagado) y uno "cancelado" — cubre
// las 5 familias (borrador queda vacía a propósito para probar su estado
// vacío en el otro test).
const SHIFTS = [
  shift({ id: "shift-publicado", status: "publicado" }),
  shift({ id: "shift-buscando-personal", status: "buscando_personal" }),
  shift({ id: "shift-asignado", status: "asignado", worker_profile_id: "wp-1" }),
  shift({ id: "shift-pagado", status: "pagado", worker_profile_id: "wp-2" }),
  shift({ id: "shift-cancelado", status: "cancelado" }),
];

async function mockEmployerShifts(page: Page) {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(EMPLOYER_SESSION) })
  );
  await page.route("**/api/v1/shifts/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(SHIFTS) })
  );
}

test("la lista va agrupada por estado: el número de cada título es el largo real de su grupo", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-07-20T12:00:00-03:00")); // el Panel filtra por semana (la tira de días)
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockEmployerShifts(page);

  await page.goto("/shifts");
  const list = page.getByTestId("shifts-panel-list");
  await expect(list).toBeVisible();

  // Sin pestañas (2026-11-21): cuatro grupos con título, y el número de cada
  // uno es exactamente lo que tiene debajo. Bug reportado: antes decía
  // "buscando 1" sin relación con la lista de abajo.
  await expect(page.getByRole("button", { name: /^(Todos|Buscando \(|En marcha \(|Terminados \(|Cancelados \()/ })).toHaveCount(0);
  const grupos = list.locator("[data-family]");
  await expect(grupos).toHaveCount(4); // "borrador" no se muestra: no tiene turnos
  const esperado: Record<string, [string, number]> = {
    buscando: ["Buscando personal", 2], // publicado + buscando_personal
    en_marcha: ["En marcha", 1],
    terminado: ["Terminados", 1],
    cancelado: ["Cancelados", 1],
  };
  for (const [familia, [titulo, n]] of Object.entries(esperado)) {
    const grupo = list.locator(`[data-family="${familia}"]`);
    await expect(grupo.getByRole("heading", { level: 2 })).toHaveText(`${titulo}${n}`);
    await expect(grupo.locator("[data-shift-id]")).toHaveCount(n);
  }

  // CERO azul: ningún elemento del panel usa los tokens de Tailwind
  // bg-blue-*/text-blue-* (el KPI "Buscando" viejo vivía en bg-blue-50
  // text-blue-600, fuera de la Ley de marca — un solo acento, el naranja).
  const blueCount = await page.locator('[class*="text-blue-"], [class*="bg-blue-"]').count();
  expect(blueCount).toBe(0);

  // Los dos turnos de "Buscando" exponen su acción principal "Elegir a alguien"
  // (ruta /shifts/[id]/candidates) y los demás grupos no la tienen.
  await expect(list.locator('[data-family="buscando"]').getByRole("link", { name: "Elegir a alguien" })).toHaveCount(2);
  await expect(list.locator('[data-family="en_marcha"]').getByRole("link", { name: "Elegir a alguien" })).toHaveCount(0);
});

test("una familia sin turnos no muestra título ni cartel de vacío; con ninguno de otra, el grupo aparece", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-07-20T12:00:00-03:00")); // el Panel filtra por semana (la tira de días)
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockEmployerShifts(page);

  await page.goto("/shifts");
  await expect(page.getByTestId("shifts-panel-list")).toBeVisible();
  await expect(page.locator('[data-family="borrador"]')).toHaveCount(0);
  await expect(page.getByText("No tenés borradores")).toHaveCount(0);

  // Sin ningún turno "en_marcha" ese grupo no existe (ni su título ni su copy de vacío).
  await page.unroute("**/api/v1/shifts/me");
  await page.route("**/api/v1/shifts/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([shift({ id: "shift-publicado", status: "publicado" })]),
    })
  );
  await page.reload();
  await expect(page.locator('[data-family="buscando"]')).toBeVisible();
  await expect(page.locator('[data-family="en_marcha"]')).toHaveCount(0);
  await expect(page.getByText("No tenés turnos en marcha")).toHaveCount(0);
});

/**
 * Un turno CONFIRMADO todavía no pasó: el trabajador aceptó y va a ir, pero
 * no llegó ni trabajó. Estaba clasificado junto a finalizado/pagado, así que
 * aparecía bajo "Terminados" mientras "En marcha" ni lo incluía — y con la
 * función de "va en camino" quedó absurdo: el trabajador viajando al local y
 * su turno figurando como terminado.
 *
 * El criterio de la familia es "¿queda algo por pasar?", no "¿está cerrado el
 * trato?". Este test lo fija por la vía que le importa al comercio: en qué
 * grupo lo encuentra.
 */
test("un turno confirmado está 'en marcha', no en 'terminados'", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-07-20T12:00:00-03:00")); // el Panel filtra por semana (la tira de días)
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(EMPLOYER_SESSION),
    })
  );
  await page.route("**/api/v1/shifts/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        shift({ id: "shift-confirmado", status: "confirmado", worker_profile_id: "wp-1" }),
      ]),
    })
  );

  await page.goto("/shifts");

  await expect(page.locator('[data-family="en_marcha"] [data-shift-id="shift-confirmado"]')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator('[data-family="terminado"]')).toHaveCount(0);
});
