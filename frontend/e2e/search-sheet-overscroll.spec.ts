import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * Regresión del bug de la operadora "el mapa de /search se refresca al mover
 * el sheet" (docs/planning/PULIDO_ROADMAP.md fix 3).
 *
 * Causa raíz real: `/search` no tiene scroll propio a nivel de documento (su
 * contenedor raíz es `h-[calc(100dvh-4rem-5rem)] overflow-hidden`, calculado
 * para ocupar exactamente el alto restante de viewport bajo el Navbar
 * `sticky` y sobre el `BottomNav` `fixed`). La lista de trabajadores vive
 * dentro de `BottomSheet.tsx`, en un `<div overflow-y-auto>`. Al arrastrar el
 * sheet (o la lista) hasta su tope/fondo y seguir tirando, ese gesto no
 * consumido "escala" al scroller raíz del documento (`document.scrollingElement`,
 * que en modo estándar es `<html>`, no `<body>`). Chrome Android interpreta
 * ese overscroll no contenido como un gesto de "pull-to-refresh": muestra su
 * spinner nativo y recarga la página ENTERA — no es un re-fetch de React, es
 * un F5 real (por eso "el mapa y la lista se refrescan").
 *
 * `overscroll-behavior-y: contain` ya estaba declarado en `body`
 * (app/globals.css), pero eso no alcanza: el elemento que Chrome liga al
 * gesto de pull-to-refresh es el *root scroller* real del documento, que es
 * `<html>` (`document.scrollingElement`), no `<body>` — gotcha documentado
 * de Chrome/web.dev sobre `overscroll-behavior`. El fix repite la propiedad
 * en `html` y, en defensa adicional, en el propio contenedor de la lista
 * (`overscroll-y-contain` en `BottomSheet.tsx`) para que el scroll interno
 * jamás encadene hacia el documento.
 *
 * No se puede simular el gesto nativo de pull-to-refresh de Chrome Android en
 * Chromium headless (es una feature de browser chrome, no de la página), así
 * que esta regresión verifica de forma determinística la propiedad CSS
 * computada en los dos puntos del fix — el mismo enfoque que
 * `map-interactivity.spec.ts` usa para el bug de #83 (clases de maplibre-gl
 * en vez de simular el arrastre real).
 */

const EMPLOYER_SESSION = {
  id: "user-1",
  email: "demo.comercio@staffya.com",
  full_name: "Comercio Demo",
  role: "employer",
  status: "activo",
  is_active: true,
  is_verified: true,
};

const WORKERS = [
  {
    profile_id: "wp-1",
    user_id: "u-1",
    full_name: "Juan Perez",
    photo_url: null,
    rating: 4.5,
    distance_km: 1.2,
    latitude: -34.6,
    longitude: -58.38,
    skills: ["mozo"],
  },
];

async function mockEmployerSearch(page: Page) {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(EMPLOYER_SESSION) })
  );
  // Con local cargado: el comercio busca desde ahí (U073).
  await page.route("**/api/v1/companies/me/profile", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "company-1", user_id: "user-1", name: "Bar Central", logo_url: null, category: null,
        description: null, address: "Honduras 5200", city: "Palermo, CABA", latitude: -34.5875,
        longitude: -58.4257, capacity: null, opening_hours: null, rating: 4.5, events_published: 0,
        on_time_payment_rate: 1, late_cancellations: 0,
      }),
    })
  );
  await page.route("**/api/v1/matching/search**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(WORKERS) })
  );
}

test("el root del documento y la lista del bottom sheet de /search contienen el overscroll (no escala a pull-to-refresh)", async ({
  page,
}) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockEmployerSearch(page);

  await page.goto("/search");
  // El conteo es el título y aparece dos veces en el DOM (panel lateral desktop
  // + cielo del mapa mobile, cada uno visible sólo en su breakpoint). En el
  // viewport mobile del test el panel desktop está `hidden`, así que filtramos
  // por el que efectivamente se ve.
  await expect(
    page.getByRole("heading", { name: /personas? cerca/ }).filter({ visible: true })
  ).toBeVisible();

  const htmlOverscroll = await page.evaluate(
    () => getComputedStyle(document.documentElement).overscrollBehaviorY
  );
  expect(htmlOverscroll).toBe("contain");

  const listOverscroll = await page.evaluate(() => {
    const list = document.querySelector(".overflow-y-auto");
    return list ? getComputedStyle(list).overscrollBehaviorY : null;
  });
  expect(listOverscroll).toBe("contain");
});
