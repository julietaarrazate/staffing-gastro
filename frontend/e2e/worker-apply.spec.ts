import { test, expect } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * Postulación desde el feed (R1.5b): sesión worker ya guardada en
 * localStorage, un turno mockeado en /shifts/feed y verificación de que
 * tocar "Me interesa" dispara el POST de postulación.
 */
test("un worker ve un turno en el feed y se postula", async ({ page }) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);

  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "user-1",
        email: "demo.mozo.palermo@staffya.com",
        full_name: "Mozo Demo",
        role: "worker",
        status: "activo",
        is_active: true,
        is_verified: true,
      }),
    })
  );

  await page.route("**/api/v1/shifts/feed", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "shift-1",
          company_id: "company-1",
          position: "mozo",
          quantity: 1,
          start_at: "2026-07-10T20:00:00-03:00",
          end_at: "2026-07-10T23:00:00-03:00",
          pay_amount: "15000",
          currency: "ARS",
          tips: true,
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
          created_at: "2026-07-01T12:00:00-03:00",
          company_name: "Bar Demo Palermo",
          company_logo_url: null,
        },
      ]),
    })
  );

  await page.route("**/api/v1/applications/mine", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  await page.route("**/api/v1/workers/me/profile", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
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
      }),
    })
  );

  let applyCalled = false;
  await page.route("**/api/v1/applications/shifts/shift-1", (route) => {
    if (route.request().method() === "POST") {
      applyCalled = true;
      return route.fulfill({ status: 201, contentType: "application/json", body: "{}" });
    }
    return route.continue();
  });

  await page.goto("/feed");

  // Se ve el turno mockeado (puesto + comercio). El viewport de test es
  // mobile (390px, ver playwright.config.ts), pero el feed renderiza EN EL
  // DOM tanto el mazo mobile como la grilla de escritorio (alternados por
  // CSS md:hidden/hidden md:block, mismo patrón que /map) — por eso el texto
  // aparece dos veces y hace falta `.first()` para no ambigüar.
  await expect(page.getByText("Mozo/a").first()).toBeVisible();
  await expect(page.getByText("Bar Demo Palermo").first()).toBeVisible();

  // waitForResponse (no waitForRequest): la respuesta sólo existe una vez
  // que el handler de route.fulfill() ya corrió, así que para cuando
  // resuelve, `applyCalled` ya está en true (evita una carrera con el
  // evento "request", que dispara antes de que corra el handler).
  const applyResponse = page.waitForResponse(
    (res) => res.url().includes("/api/v1/applications/shifts/shift-1") && res.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Me interesa" }).click();
  await applyResponse;

  expect(applyCalled).toBe(true);
});
