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

  expect(parseRequestBody).not.toBeNull();
  expect((parseRequestBody as unknown as { text: string }).text).toContain("mozo");

  // El draft vino completo (puesto, horario y pago) — el wizard salta
  // directo al último paso (revisar zona + resumen + publicar) en vez de
  // dejar al comercio tocando "Continuar" sobre pasos ya resueltos
  // (reporte real de Julieta: "no tiene sentido, en el paso uno ya se
  // bloquea"). El resumen de ese paso confirma puesto y pago precargados;
  // el horario no se muestra ahí (sólo en el paso "Cuándo", que en este
  // caso se salteó) — se verifica al publicar, más abajo.
  await expect(page.getByRole("heading", { name: "¿Dónde es?" })).toBeVisible();
  await expect(page.getByText("Mozo/a").first()).toBeVisible();
  await expect(page.getByText("ARS 45.000", { exact: false }).first()).toBeVisible();

  let publishedBody: Record<string, unknown> | null = null;
  await page.route("**/api/v1/shifts", (route) => {
    if (route.request().method() === "POST") {
      publishedBody = route.request().postDataJSON();
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: "shift-ai-1" }),
      });
    }
    return route.continue();
  });
  await page.route("**/api/v1/shifts/shift-ai-1/publish", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  );

  await page.getByRole("button", { name: "Publicar turno" }).click();

  // El turno publicado lleva el horario y el pago que vinieron del texto,
  // sin que el comercio los haya tenido que revisar paso por paso.
  expect(publishedBody).not.toBeNull();
  const body = publishedBody as unknown as {
    start_at: string;
    end_at: string;
    pay_amount: string;
  };
  expect(body.start_at).toContain("2026-08-15T20:00");
  expect(body.end_at).toContain("2026-08-16T02:00");
  expect(body.pay_amount).toBe("45000");
});

/**
 * Dictado por voz (pedido de Julieta: hablar el turno es más rápido que
 * tipearlo, "donde más se aprovecha" un asistente de IA). Web Speech API
 * nativa del navegador — Chromium headless expone el constructor aunque no
 * haya micrófono real, así que el botón aparece; no probamos la
 * transcripción en sí (requeriría audio real y permisos), sólo que el
 * botón está ahí y es clickeable sin romper la pantalla.
 */
test("el botón de dictado por voz aparece junto al textarea de descripción", async ({
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

  await page.goto("/shifts/new");

  const micButton = page.getByRole("button", { name: "Dictar por voz" });
  await expect(micButton).toBeVisible();
  await micButton.click();
  // El textarea sigue ahí y sigue siendo editable a mano, dicte o no.
  await page
    .getByPlaceholder("Ej: necesito un mozo el sábado a la noche, se paga 45000")
    .fill("mozo el sábado");
});
