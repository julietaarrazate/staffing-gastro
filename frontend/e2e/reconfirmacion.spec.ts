import { test, expect, type Page } from "@playwright/test";
import { deContrato, fulfillContrato } from "./contrato";
import { blockExternalHosts, injectSession, isoDesdeJueves as isoEnDias, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

/**
 * Reconfirmación antes del turno (ADR-0031, P3): con una pregunta pendiente,
 * la tarjeta del turno confirmado pregunta «¿Seguís disponible?» con «Sí, sigo disponible» y
 * «Ya no estoy disponible». «Ya no estoy disponible» es la cancelación de siempre, y el cartel dice si
 * cuenta o no (lo decide el backend: `cancel_with_notice`).
 */
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const AHORA = new Date(isoEnDias(0, "18:30"));
const turno = (o: Record<string, unknown>) =>
  deContrato("turnos_asignados_trabajador", [{ company_name: "Bar Lavalle", ...o }])[0];
const MANANA = { id: "s1", position: "mozo", status: "confirmado", start_at: isoEnDias(1, "18:00"), end_at: isoEnDias(1, "23:00") };

async function misTurnos(page: Page, extra: Record<string, unknown>) {
  let actual = turno({ ...MANANA, ...extra });
  const pedidos: string[] = [];
  await page.clock.setFixedTime(AHORA);
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await page.route("**/api/v1/**", (r) => (r.request().method() === "GET" ? r.fulfill(json([])) : r.continue()));
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => fulfillContrato(r, "auth_me_worker"));
  await page.route("**/api/v1/shifts/mine**", (r) => r.fulfill(json([actual])));
  await page.route("**/api/v1/shifts/s1/reconfirm", (r) => {
    pedidos.push("reconfirm");
    actual = turno({ ...MANANA, ...extra, reconfirmation_pending: false, reconfirmed_at: AHORA.toISOString() });
    return r.fulfill(json(actual));
  });
  await page.route("**/api/v1/shifts/s1/worker-cancel", (r) => {
    pedidos.push("worker-cancel");
    return r.fulfill(json(turno({ ...MANANA, status: "buscando_personal", worker_profile_id: null })));
  });
  await page.goto("/my-shifts");
  return pedidos;
}

for (const theme of ["light", "dark"] as const) {
  test(`${theme}: con una pregunta pendiente, «Sí, sigo disponible» la contesta y la pregunta se va`, async ({ page }) => {
    await setTheme(page, theme);
    const pedidos = await misTurnos(page, { reconfirmation_pending: true, cancel_with_notice: true });
    const pregunta = page.locator("[data-reconfirmar]");
    await expect(pregunta).toContainText("¿Seguís disponible para este turno?");
    await expect(pregunta.getByRole("button", { name: "Ya no estoy disponible" })).toBeVisible();
    // La pregunta entra en la pantalla: no ensancha la página.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      await page.evaluate(() => window.innerWidth),
    );

    await pregunta.getByRole("button", { name: "Sí, sigo disponible" }).click();

    await expect(pregunta).toHaveCount(0);
    expect(pedidos).toEqual(["reconfirm"]);
  });
}

test("sin pregunta pendiente no aparece nada nuevo", async ({ page }) => {
  await misTurnos(page, { reconfirmation_pending: false });
  await expect(page.getByRole("button", { name: "Cancelar mi asignación" })).toBeVisible();
  await expect(page.locator("[data-reconfirmar]")).toHaveCount(0);
});

test("«Ya no estoy disponible» avisando con tiempo: el cartel dice que no cuenta como cancelación", async ({ page }) => {
  const pedidos = await misTurnos(page, { reconfirmation_pending: true, cancel_with_notice: true });
  await page.locator("[data-reconfirmar]").getByRole("button", { name: "Ya no estoy disponible" }).click();
  const cartel = page.getByRole("dialog");
  await expect(cartel).toContainText("Como avisás con tiempo, no suma a tus cancelaciones. Vale dos veces cada 30 días.");
  expect(pedidos).toEqual([]); // nada sale hasta confirmar
  await cartel.getByRole("button", { name: "Sí, cancelar" }).click();
  await expect.poll(() => pedidos).toEqual(["worker-cancel"]);
});

test("«Ya no estoy disponible» sobre la hora: el cartel avisa que cuenta como cancelación", async ({ page }) => {
  await misTurnos(page, { reconfirmation_pending: true, cancel_with_notice: false });
  await page.locator("[data-reconfirmar]").getByRole("button", { name: "Ya no estoy disponible" }).click();
  await expect(page.getByRole("dialog")).toContainText("suma a las cancelaciones que los comercios ven en tu perfil");
});
