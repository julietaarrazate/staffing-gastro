import { test, expect } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * Comparador de turnos guardados (evolución de "guardar turnos": el pedido
 * original de Julieta era "empezar a evaluar opciones que convengan" — una
 * lista sola no compara). Selecciona 2 de los guardados y verifica que el
 * modal muestra pago, pago por hora y distancia de cada uno.
 */

const WORKER_SESSION = {
  id: "user-1",
  email: "demo.mozo@staffya.com",
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
  events_completed: 6,
  punctuality_rate: 0.95,
  cancellations: 0,
  no_shows: 0,
  badges: [],
  level: "plata",
};

function shiftFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "shift-1",
    company_id: "company-1",
    position: "mozo",
    quantity: 1,
    start_at: "2026-08-20T20:00:00-03:00",
    end_at: "2026-08-21T02:00:00-03:00",
    pay_amount: "45000",
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
    created_at: "2026-08-01T12:00:00-03:00",
    company_name: "Bar Demo Palermo",
    company_logo_url: null,
    company_verified: false,
    ...overrides,
  };
}

test("con 2+ turnos guardados, comparar muestra pago, pago por hora y distancia", async ({
  page,
}) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);

  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(WORKER_SESSION) })
  );
  await page.route("**/api/v1/shifts/mine", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/v1/applications/mine", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/v1/workers/me/profile", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(WORKER_PROFILE) })
  );
  await page.route("**/api/v1/saved-shifts", (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        shiftFixture({
          id: "shift-1",
          position: "mozo",
          pay_amount: "45000",
          company_name: "Bar Demo Palermo",
        }),
        shiftFixture({
          id: "shift-2",
          position: "barista",
          pay_amount: "30000",
          start_at: "2026-08-21T08:00:00-03:00",
          end_at: "2026-08-21T14:00:00-03:00",
          company_name: "Café Belgrano",
          latitude: -34.5627,
          longitude: -58.4584,
          meal: true,
        }),
      ]),
    });
  });

  await page.goto("/my-shifts");
  await page.getByRole("button", { name: /^Guardados/ }).click();
  await expect(page.getByText("Bar Demo Palermo")).toBeVisible();
  await expect(page.getByText("Café Belgrano")).toBeVisible();

  await page.getByRole("button", { name: "Comparar" }).click();

  // Selecciona los dos: cada click deja sólo el que falta con el aria-label
  // "Sumar a la comparación", así que no depende de índices que cambian
  // entre renders.
  await page.getByRole("button", { name: "Sumar a la comparación" }).first().click();
  await page.getByRole("button", { name: "Sumar a la comparación" }).first().click();

  const openCompare = page.getByRole("button", { name: /^Comparar \(2\)/ });
  await expect(openCompare).toBeVisible();
  await openCompare.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Comparar turnos guardados")).toBeVisible();
  // Mozo/a, 6 hs, $45.000 -> $7.500/hora.
  await expect(dialog.getByText("ARS 45.000")).toBeVisible();
  await expect(dialog.getByText("ARS 7.500")).toBeVisible();
  // Barista, 6 hs, $30.000 -> $5.000/hora, a ~4.1 km de Palermo.
  await expect(dialog.getByText("ARS 30.000")).toBeVisible();
  await expect(dialog.getByText("ARS 5.000")).toBeVisible();
  await expect(dialog.getByText("4.1 km")).toBeVisible();
});

test("un cuarto turno no se puede agregar: el tope de comparación es 3", async ({ page }) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);

  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(WORKER_SESSION) })
  );
  await page.route("**/api/v1/shifts/mine", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/v1/applications/mine", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/v1/workers/me/profile", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(WORKER_PROFILE) })
  );
  await page.route("**/api/v1/saved-shifts", (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        shiftFixture({ id: "shift-1", company_name: "Local 1" }),
        shiftFixture({ id: "shift-2", company_name: "Local 2" }),
        shiftFixture({ id: "shift-3", company_name: "Local 3" }),
        shiftFixture({ id: "shift-4", company_name: "Local 4" }),
      ]),
    });
  });

  await page.goto("/my-shifts");
  await page.getByRole("button", { name: /^Guardados/ }).click();
  await page.getByRole("button", { name: "Comparar" }).click();

  const addButtons = page.getByRole("button", { name: "Sumar a la comparación" });
  await addButtons.first().click();
  await addButtons.first().click();
  await addButtons.first().click();

  await expect(page.getByRole("button", { name: /^Comparar \(3\)/ })).toBeVisible();
  // El cuarto checkbox restante queda deshabilitado (tope alcanzado).
  await expect(addButtons.first()).toBeDisabled();
});
