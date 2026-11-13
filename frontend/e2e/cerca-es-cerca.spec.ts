import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * «Cerca» es cerca de verdad (prueba de punta a punta, 2026-11).
 *
 * El feed traía los 50 turnos más nuevos de todo el país y la pantalla sólo
 * los ordenaba: en «Cerca tuyo» aparecía uno de otra provincia. El servidor
 * ahora acota el feed a la zona del perfil (`backend/tests/test_cerca_es_cerca.py`);
 * acá se prueba la parte de la pantalla:
 *
 * - el Inicio no muestra nada más lejos que el radio, tampoco si la
 *   respuesta lo trae ni si el origen es "Estoy acá";
 * - Buscar pide todo el mercado (`scope=all`): es la pantalla para mirar
 *   otras zonas;
 * - la búsqueda del asistente mide desde la zona que la persona pidió;
 * - la ubicación del momento ("Estoy acá") no viaja al servidor.
 */

const PALERMO: [number, number] = [-34.5875, -58.4257];
const RETIRO: [number, number] = [-34.5924, -58.3746];
const CORDOBA: [number, number] = [-31.4201, -64.1888]; // a ~650 km de Palermo

const WORKER = {
  id: "user-1",
  email: "cerca@staffya.com",
  full_name: "Trabajadora",
  role: "worker",
  status: "activo",
  is_active: true,
  is_verified: true,
};

const PROFILE = {
  id: "p1",
  user_id: "user-1",
  photo_url: null,
  city: "Palermo, CABA",
  latitude: PALERMO[0],
  longitude: PALERMO[1],
  skills: ["mozo"],
  years_experience: 2,
  is_available: true,
  rating: "0",
  events_completed: 0,
  punctuality_rate: "0",
  cancellations: 0,
  no_shows: 0,
  badges: [],
  level: "bronce",
  created_at: null,
};

function shift(id: string, city: string, [lat, lng]: [number, number], urgent = false) {
  return {
    id,
    company_id: `c-${id}`,
    position: "mozo",
    quantity: 1,
    start_at: "2026-12-10T20:00:00-03:00",
    end_at: "2026-12-10T23:00:00-03:00",
    pay_amount: "50000",
    currency: "ARS",
    tips: false,
    meal: false,
    dress_code: null,
    urgent,
    address: null,
    city,
    latitude: lat,
    longitude: lng,
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
    created_at: "2026-11-01T12:00:00-03:00",
    company_name: `Bar ${city}`,
    company_logo_url: null,
  };
}

/** Sesión de trabajadora con zona en Palermo y el feed que se le pase.
 *  Devuelve la lista de pedidos al feed, para mirar qué se le mandó. */
async function setup(page: Page, feed: ReturnType<typeof shift>[]): Promise<URL[]> {
  await skipSplash(page);
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(WORKER) })
  );
  await page.route("**/api/v1/workers/me/profile", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(PROFILE) })
  );
  await page.route("**/api/v1/applications/mine", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  const feedRequests: URL[] = [];
  await page.route("**/api/v1/shifts/feed**", (r) => {
    feedRequests.push(new URL(r.request().url()));
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(feed) });
  });
  return feedRequests;
}

test("el Inicio no muestra en «Cerca tuyo» un turno de otra provincia", async ({ page }) => {
  // El de Córdoba es urgente y viene primero: sin el corte por radio sería
  // el "Recomendado" de alguien que está en Palermo.
  const feedRequests = await setup(page, [
    shift("s-cordoba", "Córdoba", CORDOBA, true),
    shift("s-palermo", "Palermo", PALERMO),
    shift("s-retiro", "Retiro", RETIRO),
  ]);

  await page.goto("/feed");

  await expect(page.getByTestId("feed-hero-card")).toContainText("Palermo");
  await expect(page.getByTestId("feed-nearby-card")).toHaveCount(1);
  await expect(page.getByTestId("feed-nearby-card")).toContainText("Retiro");
  await expect(page.getByText("Bar Córdoba")).toHaveCount(0);
  await expect(page.getByText("Recorré los 2 turnos")).toBeVisible();

  // El Inicio pide el feed de siempre: el servidor lo acota a la zona del perfil.
  expect(feedRequests.map((u) => u.search)).toEqual([""]);
});

test("con «Estoy acá» lejos de mi zona, el Inicio no llama cercano a lo que no lo es", async ({
  page,
  context,
}) => {
  // La respuesta trae lo que está cerca de la zona del perfil (Palermo)...
  const feedRequests = await setup(page, [shift("s-palermo", "Palermo", PALERMO)]);
  // ...pero la persona está en Córdoba.
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: CORDOBA[0], longitude: CORDOBA[1] });

  await page.goto("/feed");
  await expect(page.getByTestId("feed-hero-card")).toContainText("Palermo");

  await page.getByRole("button", { name: "Estoy acá" }).click();
  await expect(page.getByText("donde estás ahora", { exact: true })).toBeVisible();

  // Ya no se ofrece como cercano un turno que queda a 650 km, y la pantalla
  // dice dónde mirar en vez de dar a entender que no hay nada en ningún lado.
  await expect(page.getByTestId("feed-hero-card")).toHaveCount(0);
  await expect(page.getByText("No hay turnos cerca de donde estás ahora")).toBeVisible();

  // La ubicación del momento no sale del dispositivo: ningún pedido al feed
  // llevó coordenadas.
  expect(feedRequests.length).toBeGreaterThan(0);
  for (const url of feedRequests) {
    expect(url.searchParams.has("latitude")).toBe(false);
    expect(url.searchParams.has("longitude")).toBe(false);
  }

  await page.getByRole("button", { name: "Ver todos en Buscar" }).click();
  await expect(page).toHaveURL(/\/buscar$/);

  // De vuelta en mi zona, el turno de Palermo sigue ahí.
  await page.goto("/feed");
  await page.getByRole("button", { name: "Volver a mi zona" }).click();
  await expect(page.getByTestId("feed-hero-card")).toContainText("Palermo");
});

test("Buscar pide todo el mercado y muestra también lo que queda lejos", async ({ page }) => {
  const feedRequests = await setup(page, [
    shift("s-cordoba", "Córdoba", CORDOBA),
    shift("s-palermo", "Palermo", PALERMO),
  ]);

  await page.goto("/buscar");

  const cards = page.getByTestId("buscar-card");
  await expect(cards).toHaveCount(2);
  // Ordenado por distancia desde la zona del perfil: primero lo de acá.
  await expect(cards.nth(0)).toContainText("Bar Palermo");
  await expect(cards.nth(1)).toContainText("Bar Córdoba");

  expect(feedRequests.length).toBeGreaterThan(0);
  for (const url of feedRequests) {
    expect(url.searchParams.get("scope")).toBe("all");
  }
});

test("la búsqueda del asistente mide «cerca» desde la zona que se pidió", async ({ page }) => {
  // Perfil en Palermo, búsqueda "turnos de mozo en Córdoba".
  const feedRequests = await setup(page, [
    shift("s-cordoba", "Córdoba", CORDOBA),
    shift("s-palermo", "Palermo", PALERMO),
  ]);

  await page.goto(
    `/feed?positions=mozo&zoneLat=${CORDOBA[0]}&zoneLng=${CORDOBA[1]}&zoneName=C%C3%B3rdoba`
  );

  await expect(page.getByText("Turnos que buscaste en")).toBeVisible();
  await expect(page.getByTestId("feed-hero-card")).toContainText("Córdoba");
  // El de Palermo queda a 650 km de la zona pedida: no es de esta búsqueda.
  await expect(page.getByText("Bar Palermo")).toHaveCount(0);

  expect(feedRequests).toHaveLength(1);
  const params = feedRequests[0].searchParams;
  expect(params.get("scope")).toBe("all");
  expect(Number(params.get("latitude"))).toBeCloseTo(CORDOBA[0], 4);
  expect(Number(params.get("longitude"))).toBeCloseTo(CORDOBA[1], 4);
  expect(params.getAll("positions")).toEqual(["mozo"]);
});
