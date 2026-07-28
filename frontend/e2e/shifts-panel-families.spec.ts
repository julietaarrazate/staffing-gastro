import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * Regresión del batch "panel-por-estados" (docs/PULIDO_ROADMAP.md, bug de la
 * operadora: "activos 2 pero abajo la lista completa con inactivos; buscando
 * 1 y no muestra cuál"). Antes había 3 KPIs estáticos (uno en azul,
 * "Buscando" — fuera de la Ley de marca: un solo acento naranja) que no
 * filtraban nada; el panel entero listaba todos los turnos mezclados sin
 * agrupar. Ahora `/shifts` tiene un SegmentedControl por familia de estado
 * (Todos / Buscando / En marcha / Terminados / Cancelados) y el conteo de
 * cada pestaña es SIEMPRE el largo real de la lista que se ve al filtrar —
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

test("el conteo de cada pestaña del panel coincide siempre con las tarjetas que muestra esa pestaña", async ({
  page,
}) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockEmployerShifts(page);

  await page.goto("/shifts");
  await expect(page.getByTestId("shifts-panel-list")).toBeVisible();

  // El segmento "Buscando" anuncia (2) — exactamente publicado +
  // buscando_personal. Bug reportado: antes decía "buscando 1" sin
  // relación con la lista de abajo.
  await expect(page.getByRole("button", { name: "Buscando (2)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "En marcha (1)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Terminados (1)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancelados (1)" })).toBeVisible();

  // CERO azul: ningún elemento del panel usa los tokens de Tailwind
  // bg-blue-*/text-blue-* (el KPI "Buscando" viejo vivía en bg-blue-50
  // text-blue-600, fuera de la Ley de marca — un solo acento, el naranja).
  const blueCount = await page.locator('[class*="text-blue-"], [class*="bg-blue-"]').count();
  expect(blueCount).toBe(0);

  // Al tocar "Buscando", el panel muestra EXACTAMENTE 2 tarjetas (las
  // publicado/buscando_personal) y cada una expone su acción principal
  // "Elegir a alguien" (ruta /shifts/[id]/candidates).
  await page.getByRole("button", { name: "Buscando (2)" }).click();
  const list = page.getByTestId("shifts-panel-list");
  await expect(list.locator('[data-family="buscando"]')).toBeVisible();
  await expect(list.locator('[data-family]')).toHaveCount(1); // sólo la sección "buscando" visible
  const candidateCtas = list.getByRole("link", { name: "Elegir a alguien" });
  await expect(candidateCtas).toHaveCount(2);

  // Al tocar "En marcha", sólo esa familia queda visible con 1 tarjeta.
  await page.getByRole("button", { name: "En marcha (1)" }).click();
  await expect(list.locator('[data-family="en_marcha"]')).toBeVisible();
  await expect(list.locator('[data-family]')).toHaveCount(1);

  // Al volver a "Todos", reaparecen las familias con contenido (4: buscando,
  // en_marcha, terminado, cancelado — "borrador" queda oculta por no tener
  // turnos, no tiene sentido mostrar 5 bloques con uno vacío).
  await page.getByRole("button", { name: "Todos" }).click();
  await expect(list.locator('[data-family]')).toHaveCount(4);
});

test("una familia sin turnos muestra su propio estado vacío en voseo, no una lista en blanco", async ({ page }) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockEmployerShifts(page);

  await page.goto("/shifts");
  await expect(page.getByTestId("shifts-panel-list")).toBeVisible();

  // "Borradores" no tiene botón propio en el segmento visible (sólo Todos +
  // las 4 familias con conteo), pero si el operador entra directo por URL a
  // otra pestaña sin turnos (acá simulado con "Cancelados" vacío en otra
  // corrida) el mensaje debe hablar en voseo, no "No hay datos" genérico.
  await page.getByRole("button", { name: "En marcha (1)" }).click();
  await expect(page.getByText("No tenés turnos en marcha")).not.toBeVisible();

  // Con una respuesta sin ningún turno "en_marcha", el estado vacío de esa
  // familia debe aparecer con su copy propio.
  await page.unroute("**/api/v1/shifts/me");
  await page.route("**/api/v1/shifts/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([shift({ id: "shift-publicado", status: "publicado" })]),
    })
  );
  await page.reload();
  await page.getByRole("button", { name: "En marcha (0)" }).click();
  await expect(page.getByText("No tenés turnos en marcha")).toBeVisible();
  await expect(
    page.getByText("Cuando asignes un turno a un trabajador, va a aparecer acá hasta que se cierre.")
  ).toBeVisible();
});
