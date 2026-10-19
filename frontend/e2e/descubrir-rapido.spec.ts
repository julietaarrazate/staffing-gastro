import { test, expect } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * "Descubrir rápido" (2026-09-26): deslizar recorre el mazo, postularse es un
 * botón explícito. Antes el gesto decidía y no se podía comparar turnos.
 */
test("en Descubrir rápido se recorren los turnos sin postularse, y postularse es explícito", async ({ page }) => {
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
        {
          id: "shift-2",
          company_id: "company-1",
          position: "bartender",
          quantity: 1,
          start_at: "2026-07-10T20:00:00-03:00",
          end_at: "2026-07-10T23:00:00-03:00",
          pay_amount: "22000",
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
          company_name: "Café Nube",
          company_logo_url: null,
        },
        {
          id: "shift-3",
          company_id: "company-1",
          position: "cocinero",
          quantity: 1,
          start_at: "2026-07-10T20:00:00-03:00",
          end_at: "2026-07-10T23:00:00-03:00",
          pay_amount: "30000",
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
          company_name: "Parrilla Don Tito",
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

    let applyCalls = 0;
  await page.route("**/api/v1/applications/shifts/**", (route) => {
    if (route.request().method() === "POST") applyCalls += 1;
    return route.fulfill({ status: 201, contentType: "application/json", body: "{}" });
  });

  await page.goto("/feed");
  await page.getByRole("button", { name: /Descubrir rápido/ }).click();
  const dialog = page.getByRole("dialog", { name: "Descubrir rápido" });
  const position = dialog.getByTestId("swipe-deck-position");
  await expect(position).toHaveText("1 de 3");

  // Recorrer el mazo no compromete nada: ni postula ni saca turnos.
  await dialog.getByRole("button", { name: "Turno siguiente" }).click();
  await expect(position).toHaveText("2 de 3");
  await expect(dialog).toContainText("Café Nube");
  // Mientras la carta se anima el mazo ignora otro paso: se espera a que
  // termine (las flechas vuelven a habilitarse) antes de usar el teclado.
  await expect(dialog.getByRole("button", { name: "Turno siguiente" })).toBeEnabled();
  await page.keyboard.press("ArrowRight");
  await expect(position).toHaveText("3 de 3");
  await expect(dialog.getByRole("button", { name: "Turno siguiente" })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Turno anterior" })).toBeEnabled();
  await page.keyboard.press("ArrowLeft");
  await expect(position).toHaveText("2 de 3");
  expect(applyCalls).toBe(0);

  // Después de navegar, las acciones vuelven a estar habilitadas (la
  // animación de entrada terminó y el mazo no quedó trabado).
  const apply = dialog.getByRole("button", { name: "Postularme" });
  await expect(apply).toBeEnabled();
  await apply.click();
  await expect(position).toHaveText("2 de 2");
  await expect.poll(() => applyCalls).toBe(1);
});
