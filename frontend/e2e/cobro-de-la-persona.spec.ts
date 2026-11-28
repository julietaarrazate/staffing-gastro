import { test, expect, type Page } from "@playwright/test";
import { deContrato, fulfillContrato } from "./contrato";
import { blockExternalHosts, injectSession, isoDesdeJueves as isoEnDias, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

/**
 * «¿Ya cobraste este turno?» (2026-11-27): la persona dice si cobró desde Mis
 * turnos, y el comercio lo ve en su panel. Respuestas reales del backend
 * (e2e/contrato) con los campos nuevos encima. Capturas sólo a pedido
 * (CAPTURAS_DIR).
 */
const json = (body: unknown, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
// Jueves 19/11/2026, 18:30 de Argentina: el turno terminó esa mañana.
const AHORA = new Date(isoEnDias(0, "18:30"));
const ABRE_PRONTO = isoEnDias(1, "13:00"); // pasadas las 24 h del fin: todavía no
const ABIERTO = isoEnDias(0, "14:00");

const turno = (o: Record<string, unknown>) =>
  deContrato("turnos_asignados_trabajador", [
    {
      id: "t1",
      company_name: "Bar Lavalle",
      position: "mozo",
      status: "finalizado",
      start_at: isoEnDias(0, "08:00"),
      end_at: isoEnDias(0, "13:00"),
      unpaid_report_opens_at: ABRE_PRONTO,
      ...o,
    },
  ])[0];

async function misTurnos(page: Page, turnos: () => unknown[], rutas?: () => Promise<void>) {
  await page.clock.setFixedTime(AHORA);
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await page.route("**/api/v1/**", (r) => (r.request().method() === "GET" ? r.fulfill(json([])) : r.continue()));
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => fulfillContrato(r, "auth_me_worker"));
  await page.route("**/api/v1/shifts/mine**", (r) => r.fulfill(json(turnos())));
  await page.route("**/api/v1/reviews/shifts/*", (r) => r.fulfill(json([])));
  // Las rutas propias del caso van después: Playwright resuelve la última registrada.
  await rutas?.();
  await page.goto("/my-shifts");
}

const captura = async (page: Page, nombre: string, theme: string) => {
  if (process.env.CAPTURAS_DIR) await page.screenshot({ path: `${process.env.CAPTURAS_DIR}/${nombre}-${theme}.png`, fullPage: true });
};

for (const theme of ["light", "dark"] as const) {
  test(`${theme}: antes de las 24 h «Todavía no» está apagado y dice cuándo; «Sí, cobré» pasa a «Confirmaste el cobro»`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setTheme(page, theme);
    let estado: Record<string, unknown> = {};
    const posts: string[] = [];
    await misTurnos(page, () => [turno(estado)], () =>
      page.route("**/api/v1/shifts/t1/payment-received", (r) => {
        posts.push("payment-received");
        estado = { worker_confirmed_paid_at: AHORA.toISOString() };
        return r.fulfill(json(turno(estado)));
      }),
    );

    const caja = page.getByTestId("cobro-pregunta");
    await expect(caja).toBeVisible();
    await expect(caja.getByText("¿Ya cobraste este turno?")).toBeVisible();
    await expect(caja.getByRole("button", { name: "Todavía no" })).toBeDisabled();
    await expect(caja).toContainText("Podés avisar que todavía no cobraste el 20/11 a las 13:00");
    await captura(page, "cobro-pregunta", theme);

    await caja.getByRole("button", { name: "Sí, cobré" }).click();
    await expect(page.getByTestId("cobro-confirmado")).toHaveText("Confirmaste el cobro");
    expect(posts).toEqual(["payment-received"]);
    await captura(page, "cobro-confirmado", theme);
  });

  test(`${theme}: con el pago del comercio «Todavía no» se puede; avisado dice que soporte ya lo sabe y deja confirmar`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setTheme(page, theme);
    let estado: Record<string, unknown> = { status: "pagado", paid_at: isoEnDias(0, "14:00"), unpaid_report_opens_at: ABIERTO };
    await misTurnos(page, () => [turno(estado)], () =>
      page.route("**/api/v1/shifts/t1/payment-missing", (r) => {
        estado = { ...estado, worker_reported_unpaid_at: AHORA.toISOString() };
        return r.fulfill(json(turno(estado)));
      }),
    );

    const caja = page.getByTestId("cobro-pregunta");
    await expect(caja).toContainText("El comercio marcó este turno como pagado.");
    await expect(caja.getByRole("button", { name: "Todavía no" })).toBeEnabled();
    await caja.getByRole("button", { name: "Todavía no" }).click();

    const avisado = page.getByTestId("cobro-avisado");
    await expect(avisado).toContainText("Avisaste que no cobraste: soporte ya lo sabe");
    await expect(avisado.getByRole("button", { name: "Sí, cobré" })).toBeEnabled();
    await captura(page, "cobro-avisado", theme);
  });
}

test("«Ver como» (sólo lectura): el 403 se explica en el lugar y la pantalla no se rompe", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await misTurnos(page, () => [turno({})], () =>
    page.route("**/api/v1/shifts/t1/payment-received", (r) =>
      r.fulfill(
        json(
          { detail: { code: "impersonation_read_only", message: "Estás viendo esta cuenta en sólo lectura: no se puede cambiar nada." } },
          403,
        ),
      ),
    ),
  );
  await page.getByRole("button", { name: "Sí, cobré" }).click();
  await expect(page.getByTestId("cobro-pregunta").getByRole("alert")).toContainText("sólo lectura");
  await expect(page.getByRole("button", { name: "Sí, cobré" })).toBeEnabled();
});

for (const theme of ["light", "dark"] as const) {
  test(`${theme}: el comercio ve lo que dijo la persona en su turno`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setTheme(page, theme);
    await page.clock.setFixedTime(AHORA);
    await injectSession(page);
    await skipSplash(page);
    await blockExternalHosts(page);
    await page.route("**/api/v1/**", (r) => (r.request().method() === "GET" ? r.fulfill(json([])) : r.continue()));
    await mockEmptyNotifications(page);
    await page.route("**/api/v1/auth/me", (r) => fulfillContrato(r, "auth_me_employer", { full_name: "Comercio Demo" }));
    await page.route("**/api/v1/reviews/shifts/*", (r) => r.fulfill(json([])));
    const [base] = deContrato("turnos_del_comercio_con_asignado", [{}]);
    const turnos = [
      { ...base, id: "c1", status: "finalizado", worker_name: "Lucía Pérez", start_at: isoEnDias(0, "08:00"), end_at: isoEnDias(0, "13:00"), worker_confirmed_paid_at: AHORA.toISOString() },
      { ...base, id: "c2", status: "pagado", paid_at: isoEnDias(0, "14:00"), worker_name: "Mateo Gómez", start_at: isoEnDias(0, "09:00"), end_at: isoEnDias(0, "14:00"), worker_reported_unpaid_at: AHORA.toISOString() },
      { ...base, id: "c3", status: "finalizado", worker_name: "Sofía Ruiz", start_at: isoEnDias(0, "10:00"), end_at: isoEnDias(0, "15:00") },
    ];
    await page.route("**/api/v1/shifts/me", (r) => r.fulfill(json(turnos)));
    await page.goto("/shifts");

    const dicen = page.getByTestId("cobro-del-turno");
    await expect(dicen).toHaveCount(2);
    await expect(dicen.nth(0)).toContainText("Lucía Pérez confirmó que cobró");
    await expect(dicen.nth(1)).toContainText("Mateo Gómez avisó que todavía no cobró");
    await captura(page, "cobro-comercio", theme);
  });
}
