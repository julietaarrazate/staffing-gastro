import { test, expect, type Page } from "@playwright/test";
import { deContrato, fulfillContrato } from "./contrato";
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

// Turno de `GET /shifts/me` (el real manda un turno = una persona: `quantity` es
// siempre 1) y sesión: respuestas reales del backend (e2e/contrato).
function shift(overrides: Partial<Record<string, unknown>>) {
  return deContrato("turnos_del_comercio", [{ id: "shift-base", ...overrides }])[0];
}

const SHIFTS = [
  shift({ id: "shift-borrador", status: "borrador" }),
  shift({ id: "shift-cancelado", status: "cancelado" }),
  shift({ id: "shift-publicado", status: "publicado" }),
  shift({ id: "shift-confirmado", status: "confirmado", worker_profile_id: "wp-1" }),
];

async function mockEmployerShifts(page: Page) {
  await page.route("**/api/v1/auth/me", (route) =>
    fulfillContrato(route, "auth_me_employer")
  );
  await page.route("**/api/v1/shifts/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(SHIFTS) })
  );
}

test("en /shifts los estados se diferencian por color de marca y los cancelados quedan al final y atenuados", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2037-12-16T12:00:00-03:00")); // el Panel filtra por semana (la tira de días)
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockEmployerShifts(page);

  await page.goto("/shifts");
  await expect(page.getByText("Cancelado").first()).toBeVisible();

  // "Cancelado" va en el rojo de marca (`danger-text`), no un rojo suelto, y
  // la fila que lo contiene queda apagada (dirección suave, 2026-11-20:
  // pierde la sombra, no la opacidad, que dejaba la letra sin contraste).
  const canceladoChip = page.getByText("Cancelado", { exact: true }).first();
  await expect(canceladoChip.locator("..")).toHaveClass(/text-danger-text/);
  const canceladoCard = page.locator(".no-select", { has: canceladoChip }).first();
  await expect(canceladoCard).toHaveClass(/turno-apagado/);
  await expect(canceladoCard).toHaveCSS("opacity", "1");

  // "Confirmado" va en verde, sin apagar (sigue vivo).
  const confirmadoChip = page.getByText("Confirmado", { exact: true }).first();
  await expect(confirmadoChip.locator("..")).toHaveClass(/text-success-text/);
  const confirmadoCard = page.locator(".no-select", { has: confirmadoChip }).first();
  await expect(confirmadoCard).not.toHaveClass(/turno-apagado/);

  // "Publicado" va en azul hondo: está en curso.
  const publicadoChip = page.getByText("Publicado", { exact: true }).first();
  await expect(publicadoChip.locator("..")).toHaveClass(/text-primary-text/);

  // Orden: el cancelado (terminal) debe quedar después de los no-terminales
  // en el DOM (bug: se veían mezclados con los turnos vivos).
  const cardOrder = await page.locator(".no-select h3").allTextContents();
  const cards = await page.locator("article.no-select").all();
  const statusesInOrder: string[] = [];
  for (const card of cards) {
    // El estado se busca por su marca (`shift-status`), no por su forma.
    const text = await card.getByTestId("shift-status").textContent();
    if (text) statusesInOrder.push(text.trim());
  }
  expect(statusesInOrder.at(-1)).toBe("Cancelado");
  expect(cardOrder.length).toBeGreaterThan(0);
});

test("las tarjetas de /shifts no son seleccionables como texto de página (chrome de UI), C0 #2", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2037-12-16T12:00:00-03:00")); // el Panel filtra por semana (la tira de días)
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockEmployerShifts(page);

  await page.goto("/shifts");
  // Espera a que haya una tarjeta. (Antes esperaba el texto "2 persona(s)",
  // que la tarjeta ya no muestra: un turno es siempre una persona, ADR-0003.)
  await expect(page.locator(".no-select").first()).toBeVisible();

  const userSelect = await page.evaluate(() => {
    const el = document.querySelector(".no-select");
    return el ? getComputedStyle(el).userSelect : null;
  });
  expect(userSelect).toBe("none");
});
