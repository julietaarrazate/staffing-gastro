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

/**
 * "No cubierto" (ADR-0015): el sistema resolvió solo un turno cuyo período
 * de gracia se agotó sin llegar a CONFIRMADO. Dos cosas a probar: (1) se
 * corta como "cancelado" —sin agregar un 5º paso— pero SIN el rojo, porque
 * nadie decidió esto; (2) se ve bien en los dos temas, porque el bug de
 * septiembre (contraste de tarjetas en oscuro) enseñó que "se ve bien en
 * claro" no prueba nada sobre oscuro.
 */
test("turno no cubierto: se corta con un marcador neutro (no rojo), sin un 5º paso", async ({
  page,
}) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockEmployerShifts(page, [
    // Nunca se asignó: murió en el paso 1 (Publicado).
    shift({ id: "shift-no-cubierto-temprano", status: "no_cubierto" }),
    // Asignado y nunca confirmado: murió en el paso 2 (Asignado).
    shift({
      id: "shift-no-cubierto-asignado",
      status: "no_cubierto",
      last_no_show_worker_profile_id: "wp-1",
    }),
  ]);

  await page.goto("/shifts");

  const early = page.locator('[data-shift-id="shift-no-cubierto-temprano"]');
  await expect(early.getByText("No se cubrió en el paso 1 de 4 (Publicado)")).toBeVisible();
  // Nunca un 5º paso.
  await expect(early.getByRole("listitem")).toHaveCount(4);

  const asignado = page.locator('[data-shift-id="shift-no-cubierto-asignado"]');
  await expect(asignado.getByText("No se cubrió en el paso 2 de 4 (Asignado)")).toBeVisible();

  // El caption NO usa el rojo de "cancelado" — sería decir que alguien
  // decidió esto, y nadie lo hizo.
  const caption = early.getByText("No se cubrió en el paso 1 de 4 (Publicado)");
  await expect(caption).not.toHaveClass(/text-danger-text/);
});

test("turno no cubierto se lee igual en claro y en oscuro", async ({ page }) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockEmployerShifts(page, [shift({ id: "shift-no-cubierto-tema", status: "no_cubierto" })]);

  for (const tema of ["light", "dark"] as const) {
    await page.goto("/shifts");
    await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), tema);

    const card = page.locator('[data-shift-id="shift-no-cubierto-tema"]');
    const chip = card.getByText("No cubierto");
    await expect(chip).toBeVisible();

    // Contraste real computado del chip de estado, no clases — mismo método
    // que enseñó el bug de septiembre (tarjetas del color del lienzo).
    const medida = await chip.evaluate((el) => {
      const cs = getComputedStyle(el as HTMLElement);
      return { color: cs.color, fondo: cs.backgroundColor };
    });
    expect(medida.color, `${tema}: color de texto vacío`).not.toBe("");
    expect(medida.fondo, `${tema}: chip sin fondo`).not.toBe("rgba(0, 0, 0, 0)");
  }
});

/**
 * "Va en camino" del lado del comercio: mientras el trabajador comparte su
 * posición, la tarjeta del turno la muestra con la distancia que falta. Y
 * cuando el backend la borra (al marcar llegada), la tarjeta vuelve sola a su
 * estado normal — el bloque no debe quedar pegado con una posición vieja, que
 * es justo lo que haría que el comercio confíe en un dato que ya no vale.
 */
test("el comercio ve 'va en camino' sólo mientras el trabajador comparte", async ({
  page,
}) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockEmployerShifts(page, [
    shift({
      id: "shift-en-viaje",
      status: "confirmado",
      worker_profile_id: "wp-1",
      // El local y el trabajador, a ~1 km.
      latitude: -34.5875,
      longitude: -58.4257,
      en_route_latitude: -34.5955,
      en_route_longitude: -58.4257,
      en_route_at: new Date().toISOString(),
      // Sólo `/shifts/me` trae este dato (el backend no lo manda en las
      // vistas del trabajador).
      worker_name: "Juana Pérez",
    }),
    // Mismo turno confirmado pero sin compartir: no debe mostrar el bloque.
    shift({
      id: "shift-sin-compartir",
      status: "confirmado",
      worker_profile_id: "wp-2",
      latitude: -34.5875,
      longitude: -58.4257,
    }),
  ]);

  await page.goto("/shifts");

  const enViaje = page.locator('[data-shift-id="shift-en-viaje"]');
  // Con el nombre, no el genérico: con varios turnos confirmados a la vez,
  // "Va en camino" repetido no le dice al comercio cuál de ellos es.
  await expect(enViaje.getByText("Juana Pérez va en camino")).toBeVisible({ timeout: 15_000 });
  // La distancia es el dato que responde "¿llega?", no un adorno.
  await expect(enViaje.getByText(/\d/).filter({ hasText: /km|m ·/ }).first()).toBeVisible();

  await expect(
    page.locator('[data-shift-id="shift-sin-compartir"]').getByText("Va en camino")
  ).toHaveCount(0);
});
