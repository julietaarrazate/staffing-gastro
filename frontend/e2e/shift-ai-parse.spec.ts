import { test, expect } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * Turno por texto libre (P2, auditoría de producto 2026-08-10): el comercio
 * describe el turno en texto libre y la IA PRECARGA los pasos del wizard
 * (puesto, horario, pago) — nunca publica nada sola, el comercio sigue
 * revisando y confirmando cada paso a mano.
 */
test("describir el turno con texto precarga el wizard, sin publicar nada solo", async ({
  page,
}) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);

  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "user-2",
        email: "demo.palermo@staffya.com",
        full_name: "Comercio Demo",
        role: "employer",
        status: "activo",
        is_active: true,
        is_verified: true,
      }),
    })
  );

  let parseRequestBody: Record<string, unknown> | null = null;
  await page.route("**/api/v1/shifts/parse-text", (route) => {
    parseRequestBody = route.request().postDataJSON();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        position: "mozo",
        start_at: "2026-08-15T20:00:00-03:00",
        end_at: "2026-08-16T02:00:00-03:00",
        pay_amount: "45000",
        urgent: false,
        meal: false,
        tips: true,
        dress_code: null,
      }),
    });
  });

  await page.goto("/shifts/new");

  const continuar = page.getByRole("button", { name: "Continuar" });
  await expect(continuar).toBeDisabled();

  await page
    .getByPlaceholder("Ej: necesito un mozo el sábado a la noche, se paga 45000")
    .fill("necesito un mozo el sábado a la noche, se paga 45000");
  await page.getByRole("button", { name: "Completar" }).click();

  // El puesto queda elegido sin haber tocado ninguna tarjeta a mano.
  await expect(continuar).toBeEnabled();
  expect(parseRequestBody).not.toBeNull();
  expect((parseRequestBody as unknown as { text: string }).text).toContain("mozo");

  await continuar.click(); // Paso 1 (puesto) -> paso 2 (cantidad)
  await page.getByRole("button", { name: "Continuar" }).click(); // -> paso 3 (cuándo)

  // El horario ya viene precargado del texto.
  await expect(page.locator('input[type="datetime-local"]').first()).toHaveValue(
    "2026-08-15T20:00"
  );
  await expect(page.locator('input[type="datetime-local"]').nth(1)).toHaveValue(
    "2026-08-16T02:00"
  );
  await page.getByRole("button", { name: "Continuar" }).click(); // -> paso 4 (pago)

  // El pago también viene precargado — no hace falta tipearlo.
  await expect(page.getByPlaceholder("48000")).toHaveValue("45000");
});
