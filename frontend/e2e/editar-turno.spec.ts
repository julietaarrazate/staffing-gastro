import { test, expect, type Page } from "@playwright/test";
import { deContrato } from "./contrato";
import { blockExternalHosts, injectSession, isoEnDias, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

/**
 * Editar un turno mientras nadie esté asignado (2026-11-26): el horario, el
 * pago y la vestimenta. Con postulantes, si cambia el horario o baja el pago,
 * la pantalla anticipa que se les avisa. Con alguien asignado no se edita.
 */
const json = (body: unknown, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const EMPLOYER = { id: "user-1", email: "c@oido.test", full_name: "Julieta Demo", role: "employer", status: "activo", is_active: true, is_verified: true };
const turno = (extra: Record<string, unknown> = {}) =>
  deContrato("turno_publicado_comercio", {
    id: "shift-1", position: "mozo", start_at: isoEnDias(3, "21:00"), end_at: isoEnDias(4, "02:00"),
    pay_amount: "70000.00", dress_code: null, is_editable: true, pending_applicants_count: 0, ...extra,
  });

// «Inicio» también es un destino del menú: el campo se busca por su rótulo.
const campo = (page: Page, rotulo: string) =>
  page.locator("form label").filter({ has: page.getByText(rotulo, { exact: true }) }).locator("input");

async function editar(page: Page, extra: Record<string, unknown> = {}) {
  const guardados: Record<string, unknown>[] = [];
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json(EMPLOYER)));
  await page.route("**/api/v1/shifts/shift-1", (r) => {
    if (r.request().method() === "PUT") {
      guardados.push(r.request().postDataJSON());
      return r.fulfill(json(turno(extra)));
    }
    return r.fulfill(json(turno(extra)));
  });
  await page.goto("/shifts/shift-1/edit");
  return guardados;
}

for (const theme of ["light", "dark"] as const) {
  test(`${theme}: el formulario llega con los datos del turno y no deja guardar sin cambios`, async ({ page }) => {
    await setTheme(page, theme);
    await editar(page);
    await expect(page.getByRole("heading", { level: 1, name: "Editar turno" })).toBeVisible();
    await expect(campo(page, "Inicio")).toHaveValue(/T21:00$/);
    await expect(campo(page, "Fin")).toHaveValue(/T02:00$/);
    await expect(page.getByLabel("Pago por la jornada, en pesos")).toHaveValue("70.000");
    await expect(page.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      await page.evaluate(() => window.innerWidth),
    );
  });
}

test("cambiar la vestimenta guarda el turno entero con ese cambio, sin tocar el puesto ni el lugar", async ({ page }) => {
  const guardados = await editar(page);
  await page.getByLabel("Vestimenta").fill("Camisa negra");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect.poll(() => guardados.length).toBe(1);
  expect(guardados[0]).toMatchObject({ position: "mozo", dress_code: "Camisa negra", pay_amount: "70000" });
  expect(String(guardados[0].start_at)).toMatch(/T21:00:00-03:00$/);
});

test("con postulantes, bajar el pago anticipa que se les avisa; subirlo no", async ({ page }) => {
  await editar(page, { pending_applicants_count: 2 });
  const aviso = page.locator("[data-aviso-postulantes]");
  await expect(aviso).toHaveCount(0);
  await page.getByLabel("Pago por la jornada, en pesos").fill("90000");
  await expect(aviso).toHaveCount(0);
  await page.getByLabel("Pago por la jornada, en pesos").fill("60000");
  await expect(aviso).toContainText("Ya se postularon 2 personas");
});

test("un fin anterior al inicio no se puede guardar", async ({ page }) => {
  await editar(page);
  const inicio = await campo(page, "Inicio").inputValue();
  await campo(page, "Fin").fill(inicio);
  await expect(page.locator("#error-horario")).toContainText("El fin tiene que ser después del inicio");
  await expect(page.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
});

test("con alguien asignado no hay formulario: se explica por qué", async ({ page }) => {
  await editar(page, { status: "confirmado", is_editable: false });
  await expect(page.locator("[data-no-editable]")).toContainText("Este turno ya no se puede editar");
  await expect(page.getByRole("button", { name: "Guardar cambios" })).toHaveCount(0);
});
