import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * U080: un turno que se reabre con el horario ya empezado se reofrece como
 * urgente mientras le queden 2 horas, y se paga lo que resta desde que llega el
 * reemplazo. El backend manda el valor por hora (`hourly_pay_amount`) mientras
 * nadie llegó y el monto fijo (`prorated_pay_amount`) después; las pantallas
 * muestran lo que corresponde (`payView`, `lib/pay.ts`) y dicen que ya empezó.
 */
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

/** Hora ISO a `minutos` de ahora (negativo = pasado). */
const enMinutos = (minutos: number) => new Date(Date.now() + minutos * 60_000).toISOString();
const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
// Un reofrecido se ofrece mientras le queden 2 horas de horario.
const ofrecidoHasta = (endIso: string) =>
  hhmm(new Date(new Date(endIso).getTime() - 2 * 60 * 60_000).toISOString());

function turno(overrides: Record<string, unknown> = {}) {
  return {
    id: "reo-1",
    company_id: "company-1",
    position: "mozo",
    quantity: 1,
    // Empezó hace 40 minutos y dura 4 horas: $40.000 = $10.000 por hora.
    start_at: enMinutos(-40),
    end_at: enMinutos(200),
    pay_amount: "40000.00",
    currency: "ARS",
    tips: false,
    meal: false,
    dress_code: null,
    urgent: true,
    address: null,
    city: "Palermo, CABA",
    latitude: -34.5875,
    longitude: -58.4257,
    title: null,
    description: null,
    status: "buscando_personal",
    worker_profile_id: null,
    worker_name: null,
    en_route_latitude: null,
    en_route_longitude: null,
    en_route_at: null,
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
    created_at: enMinutos(-600),
    company_name: "Bar Lavalle",
    company_logo_url: null,
    reoffered_at: enMinutos(-20),
    hourly_pay_amount: "10000",
    prorated_pay_amount: null,
    confirmed_at: null,
    ...overrides,
  };
}

async function comoTrabajador(page: Page) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) =>
    r.fulfill(json({ id: "user-1", email: "demo@staffya.com", full_name: "Sofía Demo", role: "worker", status: "activo", is_active: true, is_verified: true }))
  );
  await page.route("**/api/v1/applications/mine", (r) => r.fulfill(json([])));
  await page.route("**/api/v1/saved-shifts", (r) => (r.request().method() === "GET" ? r.fulfill(json([])) : r.continue()));
  await page.route("**/api/v1/workers/me/profile", (r) =>
    r.fulfill(
      json({ id: "profile-1", user_id: "user-1", full_name: "Sofía Demo", photo_url: null, city: "Palermo, CABA", latitude: -34.5875, longitude: -58.4257, skills: ["mozo"], languages: [], certifications: [], is_available: true, rating: 4.8, events_completed: 10, punctuality_rate: 0.95, cancellations: 0, badges: [], level: "plata" })
    )
  );
}

async function comoComercio(page: Page, shifts: unknown[]) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await page.route("**/api/v1/**", (route) =>
    route.request().method() === "GET" ? route.fulfill(json([])) : route.continue()
  );
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) =>
    r.fulfill(json({ id: "user-9", email: "comercio@oido.test", full_name: "Bar Lavalle", role: "employer", status: "activo", is_active: true, is_verified: true }))
  );
  await page.route("**/api/v1/shifts/me**", (r) => r.fulfill(json(shifts)));
}

test("Inicio del trabajador: el turno reofrecido dice que ya empezó y cuánto paga por hora", async ({ page }) => {
  const reofrecido = turno();
  const comun = turno({
    id: "comun-1",
    company_name: "Café Colegiales",
    start_at: enMinutos(60 * 26),
    end_at: enMinutos(60 * 30),
    urgent: false,
    status: "publicado",
    reoffered_at: null,
    hourly_pay_amount: null,
  });
  await comoTrabajador(page);
  await page.route("**/api/v1/shifts/feed**", (r) => r.fulfill(json([reofrecido, comun])));
  await page.goto("/feed");

  const comanda = page.getByTestId("feed-hero-card");
  await expect(comanda).toContainText("Bar Lavalle");
  await expect(comanda.locator("dl")).toContainText(`Ya empezó · hasta las ${hhmm(reofrecido.end_at)}`);
  await expect(comanda.locator("dl")).toContainText("$10.000 por hora");
  // Nunca el monto del turno entero: el total depende de cuándo llegue.
  await expect(comanda).not.toContainText("$40.000");

  // El turno común de al lado sigue mostrando su monto.
  const cerca = page.getByRole("region", { name: "Cerca tuyo" });
  await expect(cerca).toContainText("Café Colegiales");
  await expect(cerca).toContainText("$40.000");
  await expect(cerca).not.toContainText("por hora");
});

test("Mis turnos: por hora hasta que llego, y después el monto que quedó fijo", async ({ page }) => {
  await comoTrabajador(page);
  const confirmado = turno({ status: "confirmado", worker_profile_id: "profile-1", confirmed_at: enMinutos(-5) });
  let asignados: unknown[] = [confirmado];
  await page.route("**/api/v1/shifts/mine", (r) => r.fulfill(json(asignados)));
  await page.goto("/my-shifts");

  const tarjeta = page.locator("main");
  await expect(tarjeta).toContainText("$10.000");
  await expect(tarjeta).toContainText("por hora");
  await expect(tarjeta).toContainText("Ya empezó · se paga desde que llegás");
  await expect(tarjeta).toContainText(`Ya empezó · hasta las ${hhmm(confirmado.end_at)}`);
  await expect(tarjeta).not.toContainText("$40.000");

  // Marcó la llegada: el backend fijó el monto y ya no manda el valor por hora.
  asignados = [
    turno({
      status: "check_in",
      worker_profile_id: "profile-1",
      confirmed_at: enMinutos(-5),
      check_in_at: enMinutos(-1),
      hourly_pay_amount: null,
      prorated_pay_amount: "33500.00",
    }),
  ];
  await page.reload();
  const despues = page.locator("main");
  await expect(despues).toContainText("$33.500");
  await expect(despues).toContainText("Por lo que restaba del turno desde la llegada");
  await expect(despues).not.toContainText("por hora");
  await expect(despues).not.toContainText("$40.000");
});

test("Panel del comercio: el turno reofrecido se distingue y dice hasta cuándo se ofrece", async ({ page }) => {
  const reofrecido = turno({ pending_applicants_count: 0 });
  await comoComercio(page, [reofrecido]);
  await page.goto("/shifts");

  const main = page.locator("main");
  await expect(main).toContainText(`Reofrecido como urgente hasta las ${ofrecidoHasta(reofrecido.end_at)}.`);
  await expect(main).toContainText("$10.000");
  await expect(main).toContainText("Se paga lo que reste desde que llegue el reemplazo");
});

test("«¿Marcar que no se presentó?» dice que el turno se reofrece y cómo se paga", async ({ page }) => {
  const confirmado = turno({
    status: "confirmado",
    worker_profile_id: "wp-1",
    worker_name: "Ana Gomez",
    urgent: false,
    reoffered_at: null,
    hourly_pay_amount: null,
    confirmed_at: enMinutos(-600),
  });
  await comoComercio(page, [confirmado]);
  await page.goto("/shifts");

  await page.getByRole("button", { name: "Más acciones" }).first().click();
  await page.getByRole("button", { name: /No se presentó/ }).click();
  const dialogo = page.getByRole("dialog", { name: "¿Marcar que no se presentó?" });
  await expect(dialogo).toContainText(`lo reofrecemos como urgente hasta las ${ofrecidoHasta(confirmado.end_at)}`);
  await expect(dialogo).toContainText("quien lo tome cobra lo que reste desde que llegue");
  await expect(dialogo).toContainText("le va a impactar la reputación");
});

test("al reemplazo que recién confirmó todavía no se le puede marcar la ausencia", async ({ page }) => {
  // El turno empezó hace 40 minutos, pero la persona confirmó hace 5.
  const reemplazo = turno({
    status: "confirmado",
    worker_profile_id: "wp-2",
    worker_name: "Beto Reemplazo",
    confirmed_at: enMinutos(-5),
  });
  await comoComercio(page, [reemplazo]);
  await page.goto("/shifts");

  await expect(page.locator("main")).toContainText("Beto");
  await page.getByRole("button", { name: "Más acciones" }).first().click();
  await expect(page.getByRole("dialog", { name: "Más acciones" })).toBeVisible();
  await expect(page.getByRole("button", { name: /No se presentó/ })).toHaveCount(0);
});
