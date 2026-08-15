import { test, expect } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * Turnos guardados (pedido de Julieta: "guardar turnos ordenados por
 * fecha"): un bookmark del trabajador sobre un turno abierto, para
 * evaluarlo con calma sin postularse todavía. Cubre guardar desde el feed
 * (`OpportunityCard`) y el tab "Guardados" en `/my-shifts` (postularse o
 * sacarlo desde ahí).
 */

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

function shiftFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "shift-1",
    company_id: "company-1",
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
    company_name: "Bar Demo Palermo",
    company_logo_url: null,
    company_verified: false,
    ...overrides,
  };
}

test("guardar un turno desde el feed dispara el PUT y el ícono queda marcado", async ({ page }) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);

  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(WORKER_SESSION) })
  );
  await page.route("**/api/v1/shifts/feed", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([shiftFixture()]) })
  );
  await page.route("**/api/v1/applications/mine", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/v1/workers/me/profile", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(WORKER_PROFILE) })
  );

  let isSaved = false;
  await page.route("**/api/v1/saved-shifts/shift-1/status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ is_saved: isSaved }),
    })
  );
  let putCalled = false;
  await page.route("**/api/v1/saved-shifts/shift-1", (route) => {
    if (route.request().method() === "PUT") {
      putCalled = true;
      isSaved = true;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ is_saved: true }),
      });
    }
    return route.continue();
  });

  await page.goto("/feed");

  const saveButton = page.getByRole("button", { name: "Guardar para después" }).first();
  await expect(saveButton).toBeVisible();

  const putResponse = page.waitForResponse(
    (res) => res.url().includes("/api/v1/saved-shifts/shift-1") && res.request().method() === "PUT"
  );
  await saveButton.click();
  await putResponse;

  expect(putCalled).toBe(true);
  await expect(page.getByRole("button", { name: "Quitar de guardados" }).first()).toBeVisible();
});

test("tab Guardados: lista el turno, permite postularse y sacarlo", async ({ page }) => {
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

  let savedShifts = [shiftFixture()];
  await page.route("**/api/v1/saved-shifts", (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(savedShifts),
    });
  });

  await page.goto("/my-shifts");
  await page.getByRole("button", { name: /^Guardados/ }).click();
  await expect(page.getByText("Mozo/a")).toBeVisible();
  await expect(page.getByText("Bar Demo Palermo")).toBeVisible();

  // Postularse desde acá: el turno sale de guardados (DELETE fire-and-forget)
  // y queda postulado.
  let applyCalled = false;
  await page.route("**/api/v1/applications/shifts/shift-1", (route) => {
    if (route.request().method() === "POST") {
      applyCalled = true;
      return route.fulfill({ status: 201, contentType: "application/json", body: "{}" });
    }
    return route.continue();
  });
  await page.route("**/api/v1/saved-shifts/shift-1", (route) => {
    if (route.request().method() === "DELETE") {
      savedShifts = [];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ is_saved: false }),
      });
    }
    return route.continue();
  });

  const applyResponse = page.waitForResponse(
    (res) => res.url().includes("/api/v1/applications/shifts/shift-1") && res.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Postularme" }).click();
  await applyResponse;

  expect(applyCalled).toBe(true);
  await expect(page.getByText("No tenés turnos guardados")).toBeVisible();
});

test("tab Guardados: 'Quitar de guardados' saca el turno sin postularse", async ({ page }) => {
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
  await page.route("**/api/v1/saved-shifts", (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([shiftFixture()]),
    });
  });

  let deleteCalled = false;
  await page.route("**/api/v1/saved-shifts/shift-1", (route) => {
    if (route.request().method() === "DELETE") {
      deleteCalled = true;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ is_saved: false }),
      });
    }
    return route.continue();
  });

  await page.goto("/my-shifts");
  await page.getByRole("button", { name: /^Guardados/ }).click();
  await expect(page.getByText("Mozo/a")).toBeVisible();

  await page.getByRole("button", { name: "Quitar de guardados" }).click();

  expect(deleteCalled).toBe(true);
  await expect(page.getByText("No tenés turnos guardados")).toBeVisible();
});
