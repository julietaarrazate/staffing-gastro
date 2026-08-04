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
 * `MiniMap` (thumbnail en `ShiftCard`, dentro de /my-shifts) monta un
 * `MapView interactive={false}` — maplibre-gl construye ese mapa con todos
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
  status: "asignado",
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

test("el mapa de /map sigue con el arrastre habilitado tras visitar un MiniMap no interactivo (SPA nav, reuseMaps)", async ({
  page,
}) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockWorkerRoutes(page);

  // 1) /my-shifts renderiza un ShiftCard con MiniMap (interactive: false):
  // monta y recicla un mapboxgl.Map con dragPan/touchZoomRotate/etc.
  // deshabilitados desde su construcción.
  await page.goto("/my-shifts");
  await expect(page.getByText("Bar Demo Palermo")).toBeVisible();
  await page.waitForSelector(".maplibregl-marker", { timeout: 10_000 });
  expect(await dragPanEnabled(page)).toBe(false); // el MiniMap NUNCA debe ser arrastrable.

  // 2) Navegación SPA (sin refresh) a /map: si el pool de reuseMaps recicla
  // el Map no-interactivo del MiniMap sin resincronizar sus handlers, el
  // mapa de /map queda visualmente normal pero con dragPan deshabilitado.
  await page.getByRole("link", { name: /Mapa/i }).click();
  await page.waitForURL("**/map");
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
