import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * Regresión de dos bugs de la operadora reportados sobre `/shifts` (panel del
 * comercio), docs/planning/PULIDO_ROADMAP.md batch "panel-estados-seleccion-mapa":
 *
 * Fix 1 — "los turnos cancelados o aceptados deberían poder diferenciarse":
 * antes, `ShiftCard` usaba azul para publicado/buscando/en_camino y amber
 * para asignado/check_out (fuera de la Ley de marca: "un solo acento por
 * pantalla, el naranja; verde sólo éxito; rojo sólo peligro"), y ningún
 * estado se distinguía por atenuación. El fix deja sólo 4 colores (naranja
 * activo, verde éxito/confirmado/finalizado/pagado, rojo cancelado, gris
 * borrador) y atenúa (opacity) las tarjetas en estado terminal
 * (cancelado/finalizado/pagado), además de ordenarlas al final de la lista.
 *
 * Fix 2 — "se puede seleccionar texto de la tarjeta como una página web":
 * `ShiftCard` (y `CandidateCard`, y la fila de postulantes de
 * `/shifts/[id]/candidates`) no tenían `.no-select` (el fix de #83 sólo
 * cubrió `Card.tsx` y el chrome global). El fix agrega `.no-select` a estos
 * componentes.
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

const SHIFTS = [
  shift({ id: "shift-borrador", status: "borrador" }),
  shift({ id: "shift-cancelado", status: "cancelado" }),
  shift({ id: "shift-publicado", status: "publicado" }),
  shift({ id: "shift-confirmado", status: "confirmado", worker_profile_id: "wp-1" }),
];

async function mockEmployerShifts(page: Page) {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(EMPLOYER_SESSION) })
  );
  await page.route("**/api/v1/shifts/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(SHIFTS) })
  );
}

test("en /shifts los estados se diferencian por color de marca y los cancelados quedan al final y atenuados", async ({
  page,
}) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockEmployerShifts(page);

  await page.goto("/shifts");
  await expect(page.getByText("Cancelado").first()).toBeVisible();

  // El chip de "Cancelado" usa el token rojo de marca (text-danger), no un
  // rojo suelto, y la tarjeta que lo contiene queda atenuada (opacity).
  const canceladoChip = page.getByText("Cancelado", { exact: true }).first();
  await expect(canceladoChip).toHaveClass(/text-danger/);
  const canceladoCard = page.locator(".no-select", { has: canceladoChip }).first();
  await expect(canceladoCard).toHaveClass(/opacity-65/);

  // "Confirmado" usa el verde de marca (text-secondary), sin atenuar (no es terminal el estilo, sigue activo/vivo).
  const confirmadoChip = page.getByText("Confirmado", { exact: true }).first();
  await expect(confirmadoChip).toHaveClass(/text-success-text/);
  const confirmadoCard = page.locator(".no-select", { has: confirmadoChip }).first();
  await expect(confirmadoCard).not.toHaveClass(/opacity-65/);

  // "Publicado" usa el naranja de marca (text-primary) — antes era azul.
  const publicadoChip = page.getByText("Publicado", { exact: true }).first();
  await expect(publicadoChip).toHaveClass(/text-primary/);

  // Orden: el cancelado (terminal) debe quedar después de los no-terminales
  // en el DOM (bug: se veían mezclados con los turnos vivos).
  const cardOrder = await page.locator(".no-select h3").allTextContents();
  const cards = await page.locator("div.no-select").all();
  const statusesInOrder: string[] = [];
  for (const card of cards) {
    const text = await card.locator("span.rounded-full").first().textContent();
    if (text) statusesInOrder.push(text.trim());
  }
  expect(statusesInOrder.at(-1)).toBe("Cancelado");
  expect(cardOrder.length).toBeGreaterThan(0);
});

test("las tarjetas de /shifts no son seleccionables como texto de página (chrome de UI), C0 #2", async ({ page }) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockEmployerShifts(page);

  await page.goto("/shifts");
  await expect(page.getByText("2 persona(s)").first()).toBeVisible();

  const userSelect = await page.evaluate(() => {
    const el = document.querySelector(".no-select");
    return el ? getComputedStyle(el).userSelect : null;
  });
  expect(userSelect).toBe("none");
});
