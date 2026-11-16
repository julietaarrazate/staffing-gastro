import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * U073: «Buscar trabajadores cerca» del comercio parte de su local, no del
 * Obelisco ni de donde esté el celular. Sin local cargado, la pantalla lo dice
 * y ofrece completarlo en vez de medir desde el Obelisco en silencio. El
 * trabajador que comparte ubicación sigue midiendo desde donde está.
 */

const OBELISCO = { lat: -34.6037, lng: -58.3816 };
const LOCAL = { lat: -34.5875, lng: -58.4257 };

function session(role: "employer" | "worker") {
  return {
    id: "user-1",
    email: "demo@staffya.com",
    full_name: "Demo",
    role,
    status: "activo",
    is_active: true,
    is_verified: true,
  };
}

const WORKERS = [
  {
    profile_id: "wp-1",
    user_id: "u-1",
    full_name: "Juan Perez",
    photo_url: null,
    rating: 4.5,
    distance_km: 1.2,
    latitude: -34.59,
    longitude: -58.42,
    skills: ["mozo"],
  },
];

function companyProfile(withPlace: boolean) {
  return {
    id: "company-1",
    user_id: "user-1",
    name: "Bar Central",
    logo_url: null,
    category: "bar",
    description: null,
    address: withPlace ? "Honduras 5200, Palermo" : null,
    city: withPlace ? "Palermo, CABA" : null,
    latitude: withPlace ? LOCAL.lat : null,
    longitude: withPlace ? LOCAL.lng : null,
    capacity: null,
    opening_hours: null,
    rating: 4.5,
    events_published: 3,
    on_time_payment_rate: 1,
    late_cancellations: 0,
  };
}

async function mockSearch(page: Page, role: "employer" | "worker", withPlace: boolean) {
  const searches: URL[] = [];
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session(role)) })
  );
  await page.route("**/api/v1/companies/me/profile", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(companyProfile(withPlace)) })
  );
  await page.route("**/api/v1/matching/search**", (route) => {
    searches.push(new URL(route.request().url()));
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(WORKERS) });
  });
  return searches;
}

async function prepare(page: Page) {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
}

test("el comercio con local cargado busca desde su local y la pantalla lo dice", async ({ page }) => {
  await prepare(page);
  const searches = await mockSearch(page, "employer", true);
  await page.goto("/search");

  await expect(page.getByTestId("search-origin").first()).toBeAttached();
  await expect(page.getByText("Desde tu local · Honduras 5200, Palermo").first()).toBeAttached();
  await expect.poll(() => searches.length).toBeGreaterThan(0);
  for (const url of searches) {
    expect(Number(url.searchParams.get("latitude"))).toBeCloseTo(LOCAL.lat, 4);
    expect(Number(url.searchParams.get("longitude"))).toBeCloseTo(LOCAL.lng, 4);
  }
});

test("el comercio con local cargado no mide desde el celular aunque comparta ubicación", async ({ browser }) => {
  const context = await browser.newContext({
    geolocation: { latitude: -31.4, longitude: -64.18 },
    permissions: ["geolocation"],
  });
  const page = await context.newPage();
  await prepare(page);
  const searches = await mockSearch(page, "employer", true);
  await page.goto("/search");
  await expect(page.getByTestId("search-origin").first()).toBeAttached();
  await page.waitForTimeout(800);
  expect(searches.length).toBeGreaterThan(0);
  for (const url of searches) {
    expect(Number(url.searchParams.get("latitude"))).toBeCloseTo(LOCAL.lat, 4);
  }
  await context.close();
});

test("el comercio sin local cargado ve el aviso, no se busca desde el Obelisco y puede completarlo", async ({
  page,
}) => {
  await prepare(page);
  const searches = await mockSearch(page, "employer", false);
  await page.goto("/search");

  await expect(page.getByText("Tu local no tiene ubicación").first()).toBeAttached();
  await expect(page.getByText("Falta la ubicación de tu local").first()).toBeAttached();
  await page.waitForTimeout(800);
  expect(searches).toHaveLength(0);
  expect(searches.some((u) => Number(u.searchParams.get("latitude")) === OBELISCO.lat)).toBe(false);

  await page.getByRole("button", { name: "Completar ubicación" }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/profile\/edit/);
});

test("quien no es comercio y comparte ubicación sigue midiendo desde donde está", async ({ browser }) => {
  const context = await browser.newContext({
    geolocation: { latitude: -31.4, longitude: -64.18 },
    permissions: ["geolocation"],
  });
  const page = await context.newPage();
  await prepare(page);
  const searches = await mockSearch(page, "worker", true);
  await page.goto("/search");
  await expect
    .poll(() => searches.some((u) => Math.abs(Number(u.searchParams.get("latitude")) - -31.4) < 0.001))
    .toBe(true);
  await expect(page.getByTestId("search-origin")).toHaveCount(0);
  await context.close();
});
