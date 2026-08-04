import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * Stepper del ciclo de vida del turno (`components/ShiftLifecycleStepper.tsx`,
 * docs/planning/PULIDO_ROADMAP.md, inspiración Clickie). Dos cosas a verificar:
 * 1. El paso resaltado en `ShiftCard` corresponde al estado real del turno
 *    (vista comercio en `/shifts`: Publicado → Asignado → En curso →
 *    Finalizado).
 * 2. El caso cancelado: se corta en el hito donde murió (marcador rojo
 *    "Cancelado"), sin agregar un 5º paso.
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
    created_at: "2026-07-01T12:00:00-03:00",
    company_name: null,
    company_logo_url: null,
    ...overrides,
  };
}

async function mockEmployerShifts(page: Page, shifts: unknown[]) {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(EMPLOYER_SESSION) })
  );
  await page.route("**/api/v1/shifts/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(shifts) })
  );
}

test("el stepper resalta el hito real (asignado→paso2, en curso→paso3, finalizado→paso4)", async ({
  page,
}) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockEmployerShifts(page, [
    shift({ id: "shift-asignado", status: "asignado", worker_profile_id: "wp-1" }),
    shift({ id: "shift-en-camino", status: "en_camino", worker_profile_id: "wp-1" }),
    shift({ id: "shift-finalizado", status: "finalizado", worker_profile_id: "wp-1" }),
  ]);

  await page.goto("/shifts");

  const asignadoCard = page.locator('[data-shift-id="shift-asignado"]');
  await expect(asignadoCard).toBeVisible();
  await expect(asignadoCard.getByText("Paso 2 de 4: Asignado")).toBeVisible();

  const enCaminoCard = page.locator('[data-shift-id="shift-en-camino"]');
  await expect(enCaminoCard.getByText("Paso 3 de 4: En curso")).toBeVisible();

  const finalizadoCard = page.locator('[data-shift-id="shift-finalizado"]');
  await expect(finalizadoCard.getByText("Paso 4 de 4: Finalizado")).toBeVisible();
});

test("turno cancelado: el stepper se corta con un marcador rojo en el paso donde murió, sin un 5º paso", async ({
  page,
}) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockEmployerShifts(page, [
    // Cancelado antes de asignar: murió en el paso 1 (Publicado).
    shift({ id: "shift-cancelado-temprano", status: "cancelado" }),
    // Cancelado con trabajador ya en curso (hubo check-in): murió en el paso 3.
    shift({
      id: "shift-cancelado-en-curso",
      status: "cancelado",
      worker_profile_id: "wp-1",
      check_in_at: "2026-07-10T20:05:00-03:00",
    }),
  ]);

  await page.goto("/shifts");

  const early = page.locator('[data-shift-id="shift-cancelado-temprano"]');
  await expect(early.getByText("Cancelado en el paso 1 de 4 (Publicado)")).toBeVisible();

  const late = page.locator('[data-shift-id="shift-cancelado-en-curso"]');
  await expect(late.getByText("Cancelado en el paso 3 de 4 (En curso)")).toBeVisible();

  // Nunca un 5º paso: siempre 4 numeritos (role="listitem") en el stepper de
  // cada tarjeta, cancelada o no.
  const steps = early.getByRole("listitem");
  await expect(steps).toHaveCount(4);
});
