import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, enDias, injectSession, isoEnDias, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * G14 (U055, U056, U060): el horario de un turno nuevo.
 *
 * Inicio no pasado (tolerancia de 5 minutos), duración de 1 a 16 horas, fin de
 * «21:00 a 02:00» tomado como día siguiente y dicho, «Continuar» que explica
 * por qué está gris, resumen con fecha y horario también en el celular y
 * «Duplicar» que abre en «Cuándo». La misma regla vive en el servidor
 * (`shift/domain/schedule.py`).
 */

async function prepararSesion(page: Page) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "user-1",
        email: "comercio@oido.test",
        full_name: "Bar La Esquina",
        role: "employer",
        status: "activo",
        is_active: true,
        is_verified: true,
      }),
    })
  );
  await page.route("**/api/v1/companies/me/profile", (route) =>
    route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "no" }) })
  );
}

async function irAlPasoCuando(page: Page) {
  await prepararSesion(page);
  await page.goto("/shifts/new");
  await page.getByRole("button", { name: "Mozo/a" }).click();
  await expect(page.getByText("¿Cuándo?")).toBeVisible();
}

const campos = (page: Page) => page.locator('input[type="datetime-local"]');

test("«Continuar» dice qué falta mientras no hay horario", async ({ page }) => {
  await irAlPasoCuando(page);
  const continuar = page.getByRole("button", { name: "Continuar" });
  await expect(continuar).toBeDisabled();
  await expect(page.getByTestId("motivo-continuar")).toHaveText("Elegí cuándo empieza el turno para seguir.");

  await campos(page).nth(0).fill(enDias(3, "20:00"));
  await expect(page.getByTestId("motivo-continuar")).toHaveText("Elegí cuándo termina el turno para seguir.");

  await campos(page).nth(1).fill(enDias(3, "23:00"));
  await expect(continuar).toBeEnabled();
  await expect(page.getByTestId("motivo-continuar")).toHaveCount(0);
});

test("un inicio que ya pasó se explica al lado del campo", async ({ page }) => {
  await irAlPasoCuando(page);
  await campos(page).nth(0).fill(enDias(-1, "20:00"));
  await campos(page).nth(1).fill(enDias(-1, "23:00"));
  await expect(page.getByText("Ese inicio ya pasó. Elegí un horario desde ahora en adelante.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar" })).toBeDisabled();
  await expect(page.getByTestId("motivo-continuar")).toHaveText("Corregí el horario para seguir.");
});

test("un turno de menos de 1 hora o de más de 16 se explica", async ({ page }) => {
  await irAlPasoCuando(page);
  await campos(page).nth(0).fill(enDias(3, "20:00"));
  await campos(page).nth(1).fill(enDias(3, "20:30"));
  await expect(page.getByText("Un turno dura al menos 1 hora.")).toBeVisible();

  await campos(page).nth(1).fill(enDias(4, "20:00"));
  await expect(page.getByText(/Un turno dura hasta 16 horas/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar" })).toBeDisabled();

  await campos(page).nth(1).fill(enDias(4, "12:00"));
  await expect(page.getByRole("button", { name: "Continuar" })).toBeEnabled();
});

test("«de 21:00 a 02:00» termina al día siguiente y lo dice", async ({ page }) => {
  await irAlPasoCuando(page);
  await campos(page).nth(0).fill(enDias(3, "21:00"));
  await campos(page).nth(1).fill(enDias(3, "02:00"));
  await expect(page.getByText(/Termina el \S+ a las 02:00/)).toBeVisible();
  await expect(page.getByText("Jornada de 5 h")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar" })).toBeEnabled();
});

test("el resumen del último paso dice fecha y horario en el celular, y se publica el fin del día siguiente", async ({
  page,
}) => {
  await prepararSesion(page);
  let cuerpo: { start_at: string; end_at: string } | null = null;
  await page.route("**/api/v1/shifts", (route) => {
    if (route.request().method() === "POST") {
      cuerpo = route.request().postDataJSON();
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: "s-1" }) });
    }
    return route.continue();
  });
  await page.route("**/api/v1/shifts/s-1/publish", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  );
  await page.goto("/shifts/new");
  await page.getByRole("button", { name: "Mozo/a" }).click();
  await campos(page).nth(0).fill(enDias(3, "21:00"));
  await campos(page).nth(1).fill(enDias(3, "02:00"));
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByPlaceholder("48000").fill("15000");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("¿Dónde es?")).toBeVisible();
  // 390 px: la vista previa lateral (lg+) no se ve, el resumen sí.
  await expect(page.getByText(/→/).first()).toBeVisible();
  await page.locator("select").nth(1).selectOption("Palermo");
  await page.getByRole("button", { name: "Publicar turno" }).click();
  await expect(page.getByText("¡Turno publicado!")).toBeVisible();
  expect(cuerpo!.start_at).toBe(isoEnDias(3, "21:00"));
  expect(cuerpo!.end_at).toBe(isoEnDias(4, "02:00"));
});

test("duplicar abre en «Cuándo», con la fecha corrida a una semana que no pasó", async ({ page }) => {
  await prepararSesion(page);
  await page.route("**/api/v1/shifts/orig-1", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "orig-1",
        position: "mozo",
        quantity: 1,
        start_at: isoEnDias(-20, "20:00"),
        end_at: isoEnDias(-20, "23:00"),
        pay_amount: "30000",
        tips: true,
        meal: false,
        urgent: false,
        dress_code: null,
        city: "Palermo",
        latitude: -34.58,
        longitude: -58.43,
      }),
    })
  );
  await page.goto("/shifts/new?duplicate=orig-1");
  await expect(page.getByText("¿Cuándo?")).toBeVisible();
  await expect(campos(page).nth(0)).toHaveValue(/T20:00$/);
  await expect(page.getByText("Ese inicio ya pasó.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continuar" })).toBeEnabled();
});
