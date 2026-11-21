import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * Regresión del bug de la operadora "el mapa no responde hasta refrescar"
 * (docs/planning/PULIDO_ROADMAP.md batch C0 #3).
 *
 * Causa raíz real: `components/map/MapView.tsx` usa `reuseMaps` de
 * `@vis.gl/react-maplibre`, que recicla el `mapboxgl.Map` (WebGL/canvas)
 * subyacente entre montajes vía un pool ESTÁTICO compartido por TODA la app
 * (`Maplibre.savedMaps`), sin distinguir para qué mapa era cada instancia.
 * `MiniMap` (thumbnail en `ShiftCard`, dentro de /my-shifts) montaba un
 * `MapView interactive={false}` (hasta el 2026-11-19; hoy el que queda es
 * `EnRouteMap`, el de «va en camino») — maplibre-gl construye ese mapa con todos
 * los handlers de gesto (dragPan, scrollZoom, etc.) deshabilitados. Si el
 * usuario navega (SPA, sin recargar) de una pantalla con ese mini-mapa a
 * `/map` (mapa interactivo), el mapa reciclado conserva los handlers
 * deshabilitados: se ve normal pero no responde a pan/zoom. Sólo un refresh
 * (que vacía el pool estático) daba un `Map` nuevo y correcto.
 *
 * El fix (`syncInteractiveHandlers` en `MapView.tsx`) sincroniza el estado
 * real de los handlers en cada evento `load` (se dispara también en el
 * reuse simulado) según el prop `interactive` vigente.
 *
 * Verificación: `DragPanHandler`/`TouchZoomRotateHandler` de maplibre-gl
 * togglean las clases `maplibregl-touch-drag-pan` / `maplibregl-touch-zoom-rotate`
 * en `.maplibregl-canvas-container` exactamente en su `enable()`/`disable()`
 * (maplibre-gl-dev.js) — una señal 100% determinística del estado real de
 * los handlers, a diferencia de simular un arrastre con el mouse (frágil acá
 * por el fallback a software WebGL del sandbox, con timing de frame variable).
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

const SHIFT_WITH_LOCATION = {
  id: "shift-1",
  company_id: "company-1",
  position: "mozo",
  quantity: 1,
  start_at: "2026-07-10T20:00:00-03:00",
  end_at: "2026-07-10T23:00:00-03:00",
  pay_amount: "15000",
  currency: "ARS",
  tips: true,
  dress_code: null,
  urgent: false,
  address: null,
  city: "Palermo, CABA",
  latitude: -34.5875,
  longitude: -58.4257,
  title: null,
  description: null,
  // En marcha: es la tarjeta de hoy de Mis turnos, la única que lleva el
  // MiniMap desde la dirección suave (2026-11-20).
  status: "check_in",
  worker_profile_id: "wp-1",
  check_in_latitude: null,
  check_in_longitude: null,
  check_in_at: null,
  check_out_latitude: null,
  check_out_longitude: null,
  check_out_at: null,
  paid_at: null,
  created_at: "2026-07-01T12:00:00-03:00",
  company_name: "Bar Demo Palermo",
  company_logo_url: null,
};

async function mockWorkerRoutes(page: Page) {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(WORKER_SESSION) })
  );
  await page.route("**/api/v1/shifts/mine", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([SHIFT_WITH_LOCATION]) })
  );
  await page.route("**/api/v1/shifts/feed", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([SHIFT_WITH_LOCATION]) })
  );
  await page.route("**/api/v1/applications/mine", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
}

/** `true` si maplibre-gl tiene el pan por arrastre (mouse + touch) habilitado en el mapa visible. */
async function dragPanEnabled(page: Page) {
  // `state: "attached"` (no "visible"): el contenedor colapsa a height:0 por
  // diseño de maplibre-gl (su hijo, el <canvas>, es position:absolute), así
  // que Playwright lo considera "hidden" aunque esté perfectamente funcional.
  await page.waitForSelector(".maplibregl-canvas-container", { state: "attached", timeout: 10_000 });
  await page.waitForTimeout(300); // deja correr el evento `load`/reuse antes de leer las clases.
  return page.evaluate(() => {
    const el = document.querySelector(".maplibregl-canvas-container");
    return el?.classList.contains("maplibregl-touch-drag-pan") ?? false;
  });
}

test("el mapa de /map tiene el arrastre habilitado en una carga directa", async ({ page }) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockWorkerRoutes(page);

  await page.goto("/map");
  await page.waitForSelector(".maplibregl-marker", { timeout: 10_000 });
  expect(await dragPanEnabled(page)).toBe(true);
});

test("Mis turnos ya no monta MapLibre para el mapa chico, y /map sigue arrastrable al llegar desde ahí (SPA)", async ({
  page,
}) => {
  // Desde el 2026-11-19 el mapa chico de la tarjeta (`MiniMap`) es un dibujo
  // en SVG (lib/map/mapa-chico.ts), no un `MapView`: Mis turnos no monta
  // ningún mapa de MapLibre y no puede dejarle uno no interactivo al pool de
  // `reuseMaps`. El caso que sigue vivo (el mapa de «va en camino») está en
  // el test de abajo.
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockWorkerRoutes(page);

  // El mapa chico va sólo en la tarjeta de hoy de Mis turnos (dirección suave).
  await page.clock.setFixedTime(new Date("2026-07-12T12:00:00-03:00")); // Mis turnos filtra por semana
  await page.goto("/my-shifts");
  const mapaChico = page.locator(".mapa-chico").first();
  await expect(mapaChico).toBeVisible();
  await expect(mapaChico).toContainText("Bar Demo Palermo"); // el nombre del local, junto al cuadradito
  await expect(page.locator(".maplibregl-map")).toHaveCount(0);

  // Al mapa se llega por «Buscar» y el conmutador «Lista / Mapa» (ya no hay pestaña «Mapa»), todo SPA.
  await page.getByRole("navigation", { name: "Secciones" }).getByRole("link", { name: "Buscar" }).click();
  await page.waitForURL("**/buscar");
  await page.getByRole("navigation", { name: "Cómo ver los turnos" }).getByRole("link", { name: "Mapa" }).click();
  await page.waitForURL("**/map");
  await page.waitForSelector(".maplibregl-marker", { timeout: 10_000 });
  expect(await dragPanEnabled(page)).toBe(true);
});

const EMPLOYER_SESSION = { ...WORKER_SESSION, email: "demo.comercio@staffya.com", full_name: "Comercio Demo", role: "employer" };

test("el mapa de /search sigue arrastrable tras visitar el mapa no interactivo de «va en camino» (SPA nav, reuseMaps)", async ({
  page,
}) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  await page.route("**/api/v1/**", (route) => (route.request().method() === "GET" ? route.fulfill(json([])) : route.continue()));
  await page.route("**/api/v1/auth/me", (route) => route.fulfill(json(EMPLOYER_SESSION)));
  await page.route("**/api/v1/shifts/me", (route) =>
    route.fulfill(
      json([
        {
          ...SHIFT_WITH_LOCATION,
          id: "shift-camino",
          status: "confirmado",
          start_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          end_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          worker_name: "Juana Pérez",
          en_route_latitude: -34.6,
          en_route_longitude: -58.43,
          en_route_at: new Date().toISOString(),
        },
      ])
    )
  );
  await page.route("**/api/v1/companies/me/profile", (route) =>
    route.fulfill(json({ id: "company-1", user_id: "user-1", name: "Bar Demo Palermo", logo_url: null, category: null, description: null, address: null, city: "Palermo, CABA", latitude: -34.5875, longitude: -58.4257, capacity: null, opening_hours: null, rating: 4.5, events_published: 1, on_time_payment_rate: 1, late_cancellations: 0 }))
  );
  await page.route("**/api/v1/matching/search**", (route) =>
    route.fulfill(json([{ profile_id: "w1", user_id: "u-w1", full_name: "Sofía Ramírez", photo_url: null, rating: 4.6, distance_km: 1.2, latitude: -34.585, longitude: -58.43, skills: ["mozo"], is_available: true }]))
  );

  // 1) El panel monta el mapa de «va en camino» (`EnRouteMap`, interactive: false).
  await page.goto("/shifts");
  await expect(page.getByText("Juana Pérez va en camino")).toBeVisible({ timeout: 15_000 });
  await page.waitForSelector('[data-shift-id="shift-camino"] .maplibregl-map', { timeout: 10_000 });
  expect(await dragPanEnabled(page)).toBe(false); // ese mapa NUNCA debe ser arrastrable.

  // 2) Navegación SPA a /search: si el pool de reuseMaps recicla ese Map sin
  // resincronizar sus handlers, el mapa de búsqueda queda sin arrastre.
  await page.locator('a[href="/search"]:visible').first().click();
  await page.waitForURL("**/search**");
  await page.waitForSelector(".maplibregl-marker", { timeout: 10_000 });
  expect(await dragPanEnabled(page)).toBe(true);
});

/**
 * Complemento con interacción real (arrastre de mouse) para el caso base:
 * a diferencia del chequeo de clases de arriba (determinístico), este mueve
 * el mouse de verdad — más fiel a un usuario real, aunque más sensible al
 * timing de render en el software WebGL del sandbox, por eso corre con un
 * margen de asentamiento generoso.
 */
async function dragMapUpperArea(page: Page) {
  const marker = page.locator(".maplibregl-marker").first();
  await marker.waitFor({ state: "visible", timeout: 10_000 });
  const canvas = page.locator(".maplibregl-canvas").first();
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error("no se encontró el canvas del mapa");
  const before = await marker.boundingBox();
  const cx = canvasBox.x + canvasBox.width / 2;
  const cy = canvasBox.y + canvasBox.height * 0.15; // franja superior, fuera del bottom sheet.
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 15; i++) {
    await page.mouse.move(cx + i * 12, cy + i * 2, { steps: 3 });
  }
  await page.mouse.up();
  await page.waitForTimeout(400);
  const after = await marker.boundingBox();
  return { before, after };
}

test("el mapa responde a un arrastre real de mouse en carga directa de /map", async ({ page }) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockWorkerRoutes(page);

  await page.goto("/map");
  await page.waitForTimeout(1500); // asentamiento del render WebGL (software, sandbox) antes de arrastrar.

  // El software WebGL del sandbox (sin GPU real) a veces no llega a pintar
  // el frame movido dentro de una sola pasada de arrastre — reintenta antes
  // de fallar; el chequeo determinístico de arriba ya cubre la causa raíz,
  // esto es sólo un complemento de interacción real.
  let before, after;
  for (let attempt = 0; attempt < 3; attempt++) {
    ({ before, after } = await dragMapUpperArea(page));
    if (before && after && Math.abs(after.x - before.x) > 5) break;
    await page.waitForTimeout(500);
  }
  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  expect(Math.abs(after!.x - before!.x)).toBeGreaterThan(5);
});

/**
 * El marcador lleva el PAGO, no un ícono de rubro (rediseño de mapa 2026-09).
 * El dato viaja desde el turno hasta el pin por una cadena larga —
 * `Shift.pay_amount` → propiedades del punto de supercluster → props del
 * marcador— y cualquier eslabón puede perderlo sin que falle el build: el pin
 * seguiría dibujándose, sólo que vacío. Este test fija el resultado visible.
 */
test("el marcador del mapa muestra el pago del turno", async ({ page }) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockWorkerRoutes(page);

  await page.goto("/map");
  // `pay_amount: "15000"` del fixture, con el formato de `formatArs`.
  await expect(page.getByRole("button", { name: /Turno de .*\$15\.000/ })).toBeVisible({
    timeout: 15_000,
  });
});
