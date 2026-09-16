import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * "Disponible ahora" (ADR-0014): el trabajador prende una posición vigente
 * por una ventana corta para que el comercio mida la distancia real, no la
 * de su domicilio. Dos lados a probar:
 * 1. El trabajador puede prenderlo y apagarlo desde `/profile`.
 * 2. El comercio ve la señal "Disponible ahora" en `/search` SÓLO cuando
 *    está vigente — nunca como un estado más, porque su ausencia ya es la
 *    zona del perfil (sin badge).
 */

const WORKER_SESSION = {
  id: "user-1",
  email: "disp@staffya.com",
  full_name: "Trabajadora Disponible",
  role: "worker",
  status: "activo",
  is_active: true,
  is_verified: true,
};

const WORKER_PROFILE = {
  id: "p1",
  user_id: "user-1",
  full_name: "Trabajadora Disponible",
  photo_url: null,
  city: "Palermo, CABA",
  latitude: -34.58,
  longitude: -58.43,
  skills: ["mozo"],
  years_experience: 2,
  is_available: true,
  rating: 0,
  events_completed: 0,
  punctuality_rate: 0,
  cancellations: 0,
  no_shows: 0,
  badges: [],
  level: "bronce",
  identidad_verificada: false,
  created_at: null,
};

async function mockWorkerProfileScreen(page: Page) {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(WORKER_SESSION) })
  );
  await page.route("**/api/v1/workers/me/profile", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(WORKER_PROFILE) })
  );
  await page.route("**/api/v1/workers/me/earnings", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ total_earned: "0", this_month_earned: "0", shifts_completed: 0 }),
    })
  );
  await page.route("**/api/v1/reviews/received", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/v1/identity/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ claims: [] }) })
  );
}

test("el trabajador prende y apaga 'Disponible ahora' desde su perfil", async ({
  page,
  context,
}) => {
  // Mismo mecanismo que current-location.spec.ts: permiso + coordenada del
  // browser real (vía CDP), no un stub de `navigator.geolocation` a mano.
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: -34.6, longitude: -58.45 });

  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockWorkerProfileScreen(page);

  let active = false;
  let postedBody: { latitude: number; longitude: number } | null = null;

  await page.route("**/api/v1/workers/me/available-now", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ active, until: active ? "2026-09-16T22:00:00Z" : null }),
      });
    } else if (method === "POST") {
      postedBody = route.request().postDataJSON();
      active = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ active: true, until: "2026-09-16T22:00:00Z" }),
      });
    } else if (method === "DELETE") {
      active = false;
      await route.fulfill({ status: 204, body: "" });
    }
  });

  await page.goto("/profile");
  await expect(page.getByText("Avisá que estás disponible ahora")).toBeVisible();

  await page.getByRole("button", { name: "Estoy disponible ahora" }).click();
  // `exact: true`: sin esto, "Estás disponible ahora" matchea por substring
  // (case-insensitive) contra "Avisá que **estás** disponible ahora" del
  // estado apagado, y el test pasaría en falso aunque nunca se prenda nada.
  await expect(page.getByText("Estás disponible ahora", { exact: true })).toBeVisible();
  expect(postedBody).toEqual({ latitude: -34.6, longitude: -58.45 });

  await page.getByRole("button", { name: "Dejar de compartir" }).click();
  await expect(page.getByText("Avisá que estás disponible ahora")).toBeVisible();
});

const EMPLOYER_SESSION = {
  id: "emp-1",
  email: "comercio@staffya.com",
  full_name: "Comercio Demo",
  role: "employer",
  status: "activo",
  is_active: true,
  is_verified: true,
};

function mapWorker(overrides: Partial<Record<string, unknown>>) {
  return {
    profile_id: "wp-1",
    user_id: "u-1",
    full_name: "Juan Pérez",
    photo_url: null,
    rating: 4.5,
    distance_km: 1.2,
    latitude: -34.6,
    longitude: -58.38,
    skills: ["mozo"],
    is_live: false,
    position_updated_at: null,
    ...overrides,
  };
}

test("el comercio ve 'Disponible ahora' en /search sólo cuando está vigente", async ({
  page,
}) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);

  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(EMPLOYER_SESSION) })
  );
  await page.route("**/api/v1/matching/search**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        mapWorker({
          profile_id: "wp-live",
          full_name: "Vigente",
          is_live: true,
          position_updated_at: new Date(Date.now() - 5 * 60_000).toISOString(),
        }),
        mapWorker({ profile_id: "wp-profile", full_name: "Zona del perfil", is_live: false }),
      ]),
    })
  );

  // Escritorio: el panel lateral (`aside`) tiene la MISMA lista que el
  // BottomSheet de mobile, que sigue en el DOM (oculto por CSS) a
  // cualquier viewport — sin ensanchar la ventana, `aside` existe pero no es
  // visible (`hidden md:flex`) y las aserciones de visibilidad fallarían.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/search");

  const panel = page.locator("aside");
  const liveRow = panel.getByText("Vigente").locator("..").locator("..");
  await expect(liveRow.getByText("Disponible ahora")).toBeVisible();
  await expect(liveRow.getByText(/hace \d+ min/)).toBeVisible();

  const profileRow = panel.getByText("Zona del perfil").locator("..").locator("..");
  await expect(profileRow.getByText("Disponible ahora")).toHaveCount(0);
});
