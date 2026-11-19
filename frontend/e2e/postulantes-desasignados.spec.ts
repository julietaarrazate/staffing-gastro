import { test, expect, type Page } from "@playwright/test";
import { deContrato, fulfillContrato } from "./contrato";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * G4 (U021): quien tuvo el turno asignado y lo dejó (rechazó, canceló o no se
 * presentó) aparecía en la lista de postulantes como cualquiera, con
 * «Asignar» y sin ninguna marca; con buena reputación, hasta de destacado.
 * Ahora va al final, con su marca, no suma en la pestaña, y se le puede
 * volver a asignar.
 */

// Respuestas reales del backend (e2e/contrato): sesión, postulante y turno.
const EMPLOYER = deContrato("auth_me_employer");

function applicant(overrides: Record<string, unknown>) {
  const [real] = deContrato("postulantes", [
    {
      rating: 4.2,
      events_completed: 3,
      punctuality_rate: 0.9,
      years_experience: 2,
      ...overrides,
    },
  ]);
  return real;
}

// La que rechazó tiene la mejor reputación: sin la regla sería la destacada.
const APPLICANTS = [
  applicant({
    application_id: "app-rechazo",
    worker_profile_id: "wp-rechazo",
    full_name: "Rocío Rechazó",
    status: "desasignada",
    motivo: "rechazo",
    rating: 5,
    events_completed: 40,
    punctuality_rate: 1,
  }),
  applicant({
    application_id: "app-cancelo",
    worker_profile_id: "wp-cancelo",
    full_name: "Carla Canceló",
    status: "desasignada",
    motivo: "cancelacion",
  }),
  applicant({
    application_id: "app-falto",
    worker_profile_id: "wp-falto",
    full_name: "Fabián Faltó",
    status: "desasignada",
    motivo: "ausencia",
  }),
  applicant({
    application_id: "app-sigue",
    worker_profile_id: "wp-sigue",
    full_name: "Sofía Sigue",
  }),
];

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

async function setup(page: Page) {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json(EMPLOYER)));
  await page.route("**/api/v1/shifts/shift-1", (r) =>
    r.fulfill(json(deContrato("turno_publicado_comercio", { status: "buscando_personal" })))
  );
  await page.route("**/api/v1/applications/shifts/shift-1", (r) => r.fulfill(json(APPLICANTS)));
  await page.route("**/api/v1/shifts/shift-1/candidates", (r) => r.fulfill(json([])));
}

test("quien dejó el turno va al final, con su marca, y no cuenta como postulante", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/shifts/shift-1/candidates");

  // Uno solo está en carrera: es lo que cuenta la pestaña.
  await expect(page.getByRole("button", { name: "Postulantes (1)" })).toBeVisible();

  const nombres = page.locator("a.font-semibold", { hasText: /Sofía|Rocío|Carla|Fabián/ });
  await expect(nombres.first()).toHaveText("Sofía Sigue");
  await expect(nombres).toHaveCount(4);

  const marcas = page.getByTestId("postulante-desasignado");
  await expect(marcas).toHaveCount(3);
  await expect(marcas.filter({ hasText: "Rechazó este turno" })).toHaveCount(1);
  await expect(marcas.filter({ hasText: "Canceló" })).toHaveCount(1);
  await expect(marcas.filter({ hasText: "No se presentó" })).toHaveCount(1);

  // La destacada es quien sigue en carrera, no la de mejor reputación que rechazó.
  await expect(page.getByText("Mejor valorado")).toHaveCount(1);
  await expect(
    page.locator("[data-destacado]", { hasText: "Mejor valorado" }).getByText("Sofía Sigue")
  ).toBeVisible();
});

test("a quien rechazó se le puede volver a asignar", async ({ page }) => {
  await setup(page);
  let asignado: unknown = null;
  await page.route("**/api/v1/shifts/shift-1/assign", (r) => {
    asignado = r.request().postDataJSON();
    return fulfillContrato(r, "turno_asignar");
  });
  await page.route("**/api/v1/shifts/me**", (r) => r.fulfill(json([])));
  await page.goto("/shifts/shift-1/candidates");

  const tarjeta = page
    .locator("div.no-select", { hasText: "Rocío Rechazó" })
    .filter({ has: page.getByTestId("postulante-desasignado") });
  await tarjeta.getByRole("button", { name: "Asignar" }).click();

  await expect.poll(() => asignado).toEqual({ worker_profile_id: "wp-rechazo" });
});
