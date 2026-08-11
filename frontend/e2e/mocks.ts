import { Page } from "@playwright/test";

/**
 * Helpers compartidos por los specs E2E. No hay backend real en CI: todo
 * `/api/v1/*` se mockea con page.route. Estos helpers cubren lo que se repite
 * en más de un spec (sesión en localStorage, hosts externos, notificaciones).
 */

// Claves EXACTAS que usa frontend/lib/auth-context.tsx para persistir la
// sesión. Si cambian ahí, hay que actualizarlas acá.
export const TOKEN_KEY = "staffya_token";
// TECH_DEBT.md S1: el refresh token real ya no vive en localStorage (viaja
// como cookie httpOnly) — esta es sólo la marca liviana que le dice al
// frontend que vale la pena intentar `/auth/refresh` si el access token
// vence, sin exponer ningún secreto.
export const HAS_SESSION_KEY = "staffya_has_session";

// Claves de localStorage de los mini-tours de `components/GuidedTour.tsx`
// (uno por pantalla). `injectSession` los marca como ya vistos por
// defecto: sin esto, cualquier spec que navegue a `/feed` como worker se
// topa con el overlay del tour tapando la pantalla entera y bloqueando
// clicks — el mismo síntoma que ya rompió specs de `Sheet`/`Modal` antes
// de portarlos a `document.body` (ver docs/BUGS.md). El spec dedicado al
// tour (`guided-tour.spec.ts`) limpia esta clave a propósito para
// ejercitar el flujo real.
export const GUIDED_TOUR_KEYS = ["staffya_tour_worker_feed", "staffya_tour_employer_panel"];

/** Inyecta una sesión ya logueada en localStorage antes de la primera carga. */
export async function injectSession(page: Page) {
  await page.addInitScript(
    ({ tokenKey, hasSessionKey, tourKeys }) => {
      window.localStorage.setItem(tokenKey, "e2e-fake-access-token");
      window.localStorage.setItem(hasSessionKey, "1");
      for (const key of tourKeys) window.localStorage.setItem(key, "1");
    },
    { tokenKey: TOKEN_KEY, hasSessionKey: HAS_SESSION_KEY, tourKeys: GUIDED_TOUR_KEYS }
  );
}

/**
 * Bloquea hosts externos que no hacen falta para los flujos testeados
 * (fotos demo y estilo de mapa) para que ningún spec dependa de la red.
 */
export async function blockExternalHosts(page: Page) {
  await page.route(
    (url) =>
      /cartocdn\.com$/.test(url.hostname) ||
      /loremflickr\.com$/.test(url.hostname) ||
      /pravatar\.cc$/.test(url.hostname),
    (route) => route.abort()
  );
  // Cualquier pedido de estilo de mapa (MapLibre) se responde con un estilo
  // vacío para no depender de CARTO.
  await page.route(/\/style\.json(\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ version: 8, sources: {}, layers: [] }),
    })
  );
}

/**
 * Salta la splash de marca (components/SplashScreen.tsx): se muestra una vez
 * por `sessionStorage` con una coreografía de ~1.1s que en un screenshot
 * tapa todo el contenido de abajo. No hace falta para verificar los flujos.
 */
export async function skipSplash(page: Page) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem("staffya_splash_seen", "1");
  });
}

/** GET /notifications -> [] (lo pide el Navbar en cuanto hay sesión). */
export async function mockEmptyNotifications(page: Page) {
  await page.route("**/api/v1/notifications", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }
    return route.continue();
  });
}
