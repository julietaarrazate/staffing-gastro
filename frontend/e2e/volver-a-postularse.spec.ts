import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * Volver a postularse (salida a beta, 2026-11-11). El cartel de "¿Cancelar
 * tu postulación?" promete "si sigue abierto, podés volver a postularte",
 * pero el turno desaparecía de Inicio y de Buscar para siempre: las pantallas
 * escondían cualquier turno con una postulación, también retirada.
 *
 * "Ya me postulé" es ahora tener una postulación ACTIVA (`appliedShiftIds`,
 * `lib/applications.ts`). Este spec recorre el camino entero con la API
 * simulada: postulado → retira → el turno reaparece → se postula de nuevo.
 * El detalle (`/turno/[id]`) se arma en el servidor y no se puede simular
 * acá: lo cubre `components/ShiftDetail.test.tsx`.
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

const SHIFT = {
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
};

function json(body: unknown, status = 200) {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

/**
 * API simulada con la regla del backend: una sola postulación por (turno,
 * trabajador); retirarla la deja `retirada` y postularse de nuevo reactiva
 * esa misma (mismo id), no crea otra.
 */
async function mockApi(page: Page) {
  const application = {
    id: "app-1",
    shift_id: SHIFT.id,
    worker_profile_id: WORKER_PROFILE.id,
    status: "pendiente",
    created_at: "2026-07-02T10:00:00-03:00",
  };
  const calls = { withdraw: 0, apply: 0 };

  await page.route("**/api/v1/auth/me", (route) => route.fulfill(json(WORKER_SESSION)));
  await page.route("**/api/v1/workers/me/profile", (route) => route.fulfill(json(WORKER_PROFILE)));
  // Inicio pide `/shifts/feed`; Buscar le suma los rubros en la query.
  await page.route(/\/api\/v1\/shifts\/feed(\?.*)?$/, (route) => route.fulfill(json([SHIFT])));
  await page.route("**/api/v1/shifts/mine", (route) => route.fulfill(json([])));
  await page.route("**/api/v1/saved-shifts", (route) => route.fulfill(json([])));
  await page.route("**/api/v1/saved-shifts/ids", (route) => route.fulfill(json({ shift_ids: [] })));
  await page.route(/\/api\/v1\/applications\/mine(\?.*)?$/, (route) =>
    route.fulfill(json([{ ...application, shift: SHIFT }]))
  );
  await page.route("**/api/v1/applications/app-1/withdraw", (route) => {
    calls.withdraw += 1;
    application.status = "retirada";
    return route.fulfill(json(application));
  });
  await page.route("**/api/v1/applications/shifts/shift-1", (route) => {
    if (route.request().method() !== "POST") return route.continue();
    calls.apply += 1;
    if (application.status !== "retirada") {
      return route.fulfill(json({ detail: "Ya te postulaste a este turno" }, 409));
    }
    application.status = "pendiente";
    return route.fulfill(json(application, 201));
  });

  return { application, calls };
}

test("retirar la postulación devuelve el turno a Inicio y a Buscar, y permite postularse de nuevo", async ({
  page,
}) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  const { application, calls } = await mockApi(page);

  // Postulado: el turno no se ofrece en Inicio.
  await page.goto("/feed");
  await expect(page.getByText("No hay más turnos cerca").first()).toBeVisible();
  await expect(page.getByTestId("feed-hero-card")).toHaveCount(0);

  // Retira la postulación desde Matches. El cartel promete que puede volver.
  await page.goto("/my-shifts");
  await page.getByRole("button", { name: "Postulaciones (1)" }).click();
  await page.getByRole("button", { name: "Cancelar postulación" }).click();
  const dialog = page.getByRole("dialog", { name: "¿Cancelar tu postulación?" });
  await expect(dialog).toContainText("podés volver a postularte");
  const withdrawResponse = page.waitForResponse((res) => res.url().includes("/applications/app-1/withdraw"));
  await dialog.getByRole("button", { name: "Sí, cancelar" }).click();
  await withdrawResponse;
  expect(application.status).toBe("retirada");
  await expect(page.getByText("No tenés postulaciones activas")).toBeVisible();

  // El turno sigue abierto: reaparece en Buscar...
  await page.goto("/buscar");
  await expect(page.getByTestId("buscar-card")).toHaveCount(1);
  await expect(page.getByTestId("buscar-card")).toContainText("Bar Demo Palermo");

  // ...y en Inicio, donde se postula de nuevo desde "Descubrir rápido".
  await page.goto("/feed");
  const hero = page.getByTestId("feed-hero-card");
  await expect(hero).toContainText("Mozo/a");
  await expect(hero).toContainText("Bar Demo Palermo");
  await page.getByRole("button", { name: /Descubrir rápido/ }).click();
  const deck = page.getByRole("dialog", { name: "Descubrir rápido" });
  await expect(deck.getByTestId("swipe-deck-position")).toHaveText("1 de 1");
  const applyResponse = page.waitForResponse(
    (res) => res.url().includes("/api/v1/applications/shifts/shift-1") && res.request().method() === "POST"
  );
  await deck.getByRole("button", { name: "Postularme" }).click();
  expect((await applyResponse).status()).toBe(201);
  expect(application.status).toBe("pendiente");
  expect(calls).toEqual({ withdraw: 1, apply: 1 });

  // Queda postulado otra vez, con la misma postulación: una sola en Matches.
  await page.goto("/my-shifts");
  await page.getByRole("button", { name: "Postulaciones (1)" }).click();
  await expect(page.getByText("Postulado · esperando respuesta")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancelar postulación" })).toHaveCount(1);
});
