import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * G18 (U064, U104) · en compu también se llega al detalle y a Buscar. La
 * tarjeta de la grilla del Inicio y de `/buscar` (`OpportunityCard`) y la fila
 * del panel del mapa llevan a `/turno/[id]` con un link real; lo de adentro
 * (postularse, guardar) no navega. En celular, el Inicio sigue siendo el mazo.
 */

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

const WORKER = {
  id: "user-1",
  email: "demo.mozo@staffya.com",
  full_name: "Mozo Demo",
  role: "worker",
  status: "activo",
  is_active: true,
  is_verified: true,
};

function shift(id: string, company: string) {
  return {
    id,
    company_id: `c-${id}`,
    position: "mozo",
    quantity: 1,
    start_at: "2026-12-10T20:00:00-03:00",
    end_at: "2026-12-10T23:00:00-03:00",
    pay_amount: "15000",
    currency: "ARS",
    tips: true,
    meal: false,
    dress_code: null,
    urgent: false,
    address: null,
    city: "Palermo, CABA",
    latitude: -34.58,
    longitude: -58.42,
    title: null,
    description: null,
    status: "publicado",
    worker_profile_id: null,
    event_id: null,
    event_name: null,
    created_at: "2026-11-01T12:00:00-03:00",
    company_name: company,
    company_logo_url: null,
    company_verified: false,
  };
}

async function base(page: Page) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json(WORKER)));
  await page.route("**/api/v1/shifts/feed**", (r) => r.fulfill(json([shift("s1", "Bar Uno"), shift("s2", "Bar Dos")])));
  await page.route("**/api/v1/applications/mine", (r) => r.fulfill(json([])));
  await page.route("**/api/v1/saved-shifts/ids", (r) => r.fulfill(json({ shift_ids: [] })));
  await page.route("**/api/v1/workers/me/profile", (r) => r.fulfill(json({}, 404)));
  // `/turno/[id]` se arma en el servidor: sólo importa a dónde se navega.
  await page.route("**/turno/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<html><body>detalle</body></html>" }));
}

for (const [ruta, testid] of [
  ["/feed", "feed-grid-card"],
  ["/buscar", "buscar-card"],
] as const) {
  test.describe(`${ruta} en compu (1280 px)`, () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test("la tarjeta entera abre el detalle del turno", async ({ page }) => {
      await base(page);
      await page.goto(ruta);
      const card = page.getByTestId(testid).first();
      await expect(card).toBeVisible({ timeout: 15_000 });
      const link = card.getByTestId("opportunity-card-link");
      await expect(link).toHaveAttribute("href", "/turno/s1");
      // Un toque en el medio de la tarjeta (no sobre el título) navega.
      const box = (await card.boundingBox())!;
      await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.55);
      await expect(page).toHaveURL(/\/turno\/s1$/);
    });

    test("se llega con el teclado: Tab hasta el link y Enter", async ({ page }) => {
      await base(page);
      await page.goto(ruta);
      const link = page.getByTestId(testid).first().getByTestId("opportunity-card-link");
      await expect(link).toBeVisible({ timeout: 15_000 });
      await link.focus();
      await expect(link).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/turno\/s1$/);
    });

    test("postularse y guardar no navegan", async ({ page }) => {
      await base(page);
      let guardado = false;
      await page.route("**/api/v1/saved-shifts/s1", (r) => {
        guardado = true;
        return r.fulfill(json({ is_saved: true }));
      });
      await page.route("**/api/v1/applications**", (r) =>
        r.request().method() === "POST" ? r.fulfill(json({ id: "a1", status: "pendiente" })) : r.fulfill(json([]))
      );
      await page.goto(ruta);
      const card = page.getByTestId(testid).first();
      await expect(card).toBeVisible({ timeout: 15_000 });
      await card.getByRole("button", { name: /guardar/i }).click();
      await expect.poll(() => guardado).toBe(true);
      await expect(page).toHaveURL(new RegExp(`${ruta}$`));
      await card.getByRole("button", { name: "Postularme" }).click();
      await page.waitForTimeout(500);
      await expect(page).toHaveURL(new RegExp(`${ruta}$`));
    });
  });
}

test.describe("barra superior en compu (1280 px)", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("«Buscar» está en el menú del trabajador y lleva a /buscar", async ({ page }) => {
    await base(page);
    await page.goto("/feed");
    const nav = page.getByRole("navigation", { name: "Principal" });
    await expect(nav.getByRole("link", { name: "Turnos", exact: true })).toBeVisible({ timeout: 15_000 });
    await nav.getByRole("link", { name: "Buscar" }).click();
    await expect(page).toHaveURL(/\/buscar$/);
    await expect(nav.getByRole("link", { name: "Buscar" })).toHaveAttribute("aria-current", "page");
  });
});

test.describe("celular (390 px)", () => {
  test("el Inicio sigue siendo el mazo: sin grilla ni links de tarjeta", async ({ page }) => {
    await base(page);
    await page.goto("/feed");
    await expect(page.getByTestId("feed-hero-card")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("feed-grid-card")).toHaveCount(0);
    await expect(page.getByTestId("opportunity-card-link")).toHaveCount(0);
  });

  test("Buscar: la tarjeta también abre el detalle", async ({ page }) => {
    await base(page);
    await page.goto("/buscar");
    const link = page.getByTestId("buscar-card").first().getByTestId("opportunity-card-link");
    await expect(link).toHaveAttribute("href", "/turno/s1", { timeout: 15_000 });
  });
});

test("mapa en compu: la fila del panel lleva al detalle y «Postularme» no navega", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await base(page);
  await page.route(/basemaps\.cartocdn\.com\/gl\/.*\/style\.json/, (r) => r.abort());
  await page.goto("/map");
  const link = page.getByTestId("map-row-link").first();
  await expect(link).toHaveAttribute("href", "/turno/s1", { timeout: 15_000 });
  // «Postularme» de la fila no navega (se abre una hoja, la URL no cambia).
  await page.getByRole("button", { name: "Postularme" }).first().click();
  await page.waitForTimeout(500);
  await expect(page).toHaveURL(/\/map$/);
  await page.keyboard.press("Escape");
  await link.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/turno\/s1$/);
});
