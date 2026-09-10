import { test, expect } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * Regresión de "no se ve el mapa ni en comercio ni en trabajador"
 * (reporte de Julieta, 2026-09-09).
 *
 * CAUSA RAÍZ: maplibre-gl 6 arma la URL de su web worker con `import.meta.url`
 * y, si eso no es una URL http(s) —que es justo lo que pasa dentro del bundle
 * de Next—, devuelve cadena VACÍA y hace `new Worker("", {type:"module"})`. El
 * worker no arranca, ningún tile vectorial se parsea, el evento `load` no se
 * dispara nunca y el mapa queda en blanco: sin fondo, sin pines y **sin un
 * solo error en consola**. Fix: `lib/map/worker.ts` + `scripts/copy-maplibre-worker.mjs`.
 *
 * POR QUÉ NINGÚN TEST LO VIO, que es lo que este archivo viene a arreglar: el
 * estilo mockeado de `blockExternalHosts` es `{sources:{}, layers:[]}`. Sin
 * una sola fuente, maplibre nunca necesita el worker, así que TODA la suite
 * pasaba en verde con el worker roto. Medido: con ese estilo vacío el mapa
 * carga; basta que UNA capa use una fuente vectorial —como el estilo real de
 * CARTO— para que no cargue nunca.
 *
 * Por eso este spec sirve un estilo con la misma FORMA que el real (fuente
 * vectorial + capa que la usa + glyphs + sprite) y no se conforma con que el
 * canvas exista: exige que los marcadores estén en el DOM, que es lo que
 * cuelga del `load`.
 */

const WORKER_SESSION = {
  id: "user-1",
  email: "mozo@staffya.test",
  full_name: "Mozo Demo",
  role: "worker",
  status: "activo",
  is_active: true,
  is_verified: true,
};

const SHIFT = {
  id: "shift-1",
  company_id: "company-1",
  position: "mozo",
  quantity: 1,
  start_at: "2026-09-11T20:00:00-03:00",
  end_at: "2026-09-12T02:00:00-03:00",
  pay_amount: "45000",
  currency: "ARS",
  tips: false,
  meal: false,
  dress_code: null,
  urgent: false,
  address: "Gorriti 5000",
  city: "Palermo, CABA",
  latitude: -34.5875,
  longitude: -58.4257,
  title: null,
  description: null,
  status: "publicado",
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
  created_at: "2026-09-01T12:00:00-03:00",
  company_name: "Bar Demo",
  company_logo_url: null,
  company_verified: false,
  pay_band: "tipico",
};

/** Misma forma que el estilo real de CARTO Voyager, servido sin salir a la red. */
const ESTILO_CON_FUENTE_VECTORIAL = {
  version: 8,
  name: "regresion-worker",
  sprite: "https://basemaps.cartocdn.com/gl/voyager-gl-style/sprite",
  glyphs: "https://basemaps.cartocdn.com/fonts/{fontstack}/{range}.pbf",
  sources: {
    carto: {
      type: "vector",
      tiles: ["https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/{z}/{x}/{y}.mvt"],
      minzoom: 0,
      maxzoom: 14,
    },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#f2efe9" } },
    {
      id: "roads",
      type: "line",
      source: "carto",
      "source-layer": "transportation",
      paint: { "line-color": "#ffffff", "line-width": 2 },
    },
  ],
};

test("el mapa del trabajador dibuja sus pines con un estilo de fuente vectorial", async ({
  page,
}) => {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);

  // OJO CON EL ORDEN: Playwright resuelve las rutas al revés (gana la última
  // registrada), así que todo lo de acá abajo va DESPUÉS de
  // `blockExternalHosts` para pisar su estilo vacío y su bloqueo de cartocdn.
  await page.route(/basemaps\.cartocdn\.com\/gl\/.*\/style\.json/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(ESTILO_CON_FUENTE_VECTORIAL),
    })
  );
  // Los tiles y el sprite no hacen falta para que el estilo cargue; se
  // responden vacíos para no salir a la red y no dejar pedidos colgados.
  await page.route(/tiles\.basemaps\.cartocdn\.com/, (route) =>
    route.fulfill({ status: 204, body: "" })
  );
  await page.route(/\/sprite(@2x)?\.(json|png)/, (route) =>
    route.fulfill({ status: 404, body: "" })
  );

  await page.route("**/api/v1/**", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
      : route.continue()
  );
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/shifts/feed", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([SHIFT]),
    })
  );
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(WORKER_SESSION),
    })
  );

  await page.goto("/map");

  // Los marcadores son hijos de `MapView` y sólo se montan después del evento
  // `load` (ver el gate en MapView.tsx). Que estén en el DOM ES la prueba de
  // que el estilo terminó de cargar, o sea de que el worker arrancó.
  await expect(page.locator(".maplibregl-marker").first()).toBeVisible({ timeout: 20_000 });

  // Y el fallback de error NO tiene que aparecer: si aparece, el mapa falló.
  await expect(page.getByText("No pudimos cargar el mapa")).toHaveCount(0);
});

test("si el estilo no carga, el mapa lo dice y ofrece reintentar", async ({ page }) => {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);

  // El estilo falla de verdad (no responde nunca con un 200): antes esto daba
  // una caja en blanco perfecta, sin mensaje ni forma de reintentar.
  await page.route(/basemaps\.cartocdn\.com\/gl\/.*\/style\.json/, (route) => route.abort());

  await page.route("**/api/v1/**", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
      : route.continue()
  );
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(WORKER_SESSION),
    })
  );

  await page.goto("/map");

  await expect(page.getByText("No pudimos cargar el mapa")).toBeVisible({ timeout: 25_000 });
  await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
});
