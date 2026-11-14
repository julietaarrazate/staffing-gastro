import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * G5 · los sellos de confianza dicen la verdad. «Comercio verificado» en la
 * tarjeta del feed del trabajador (`OpportunityCard`, `company_verified`) y
 * «Identidad verificada» en la lista de postulantes del comercio
 * (`identidad_verificada`). El perfil del comercio se cubre en
 * `business-verification.spec.ts`.
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

const EMPLOYER = { ...WORKER, email: "demo.comercio@staffya.com", role: "employer" };

function shift(id: string, company: string, verified: boolean) {
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
    company_verified: verified,
  };
}

function applicant(id: string, name: string, verified: boolean) {
  return {
    application_id: `app-${id}`,
    worker_profile_id: id,
    full_name: name,
    photo_url: null,
    rating: 4.5,
    is_available: true,
    status: "pendiente",
    created_at: "2026-11-10T12:00:00-03:00",
    events_completed: 6,
    punctuality_rate: 0.9,
    years_experience: 2,
    badges: [],
    level: "bronce",
    identidad_verificada: verified,
  };
}

async function base(page: Page, session: unknown) {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json(session)));
}

test("el feed muestra «Comercio verificado» sólo en el turno del comercio verificado", async ({ page }) => {
  // La grilla de `OpportunityCard` es la vista de escritorio del feed.
  await page.setViewportSize({ width: 1280, height: 900 });
  await base(page, WORKER);
  await page.route("**/api/v1/shifts/feed", (r) =>
    r.fulfill(json([shift("s1", "Bar Verificado", true), shift("s2", "Bar Común", false)]))
  );
  await page.route("**/api/v1/applications/mine", (r) => r.fulfill(json([])));
  await page.route("**/api/v1/saved-shifts/ids", (r) => r.fulfill(json({ shift_ids: [] })));
  await page.route("**/api/v1/workers/me/profile", (r) => r.fulfill(json({}, 404)));

  await page.goto("/feed");

  await expect(page.getByText("Bar Verificado").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Bar Común").first()).toBeVisible();
  await expect(page.getByText("Comercio verificado", { exact: true })).toHaveCount(1);
});

test("los postulantes muestran «Identidad verificada» sólo con el documento aprobado", async ({ page }) => {
  await base(page, EMPLOYER);
  await page.route("**/api/v1/shifts/shift-1", (r) => r.fulfill(json({}, 404)));
  await page.route("**/api/v1/applications/shifts/shift-1", (r) =>
    r.fulfill(json([applicant("wp-1", "Lucía Verificada", true), applicant("wp-2", "Mateo Común", false)]))
  );
  await page.route("**/api/v1/shifts/shift-1/candidates", (r) => r.fulfill(json([])));

  await page.goto("/shifts/shift-1/candidates");

  await expect(page.getByText("Lucía Verificada")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Mateo Común")).toBeVisible();
  await expect(page.getByText("Identidad verificada", { exact: true })).toHaveCount(1);
});

async function feedMovil(page: Page, shifts: unknown[]) {
  await base(page, WORKER);
  await page.route("**/api/v1/shifts/feed", (r) => r.fulfill(json(shifts)));
  await page.route("**/api/v1/applications/mine", (r) => r.fulfill(json([])));
  await page.route("**/api/v1/saved-shifts/ids", (r) => r.fulfill(json({ shift_ids: [] })));
  await page.route("**/api/v1/workers/me/profile", (r) => r.fulfill(json({}, 404)));
  await page.goto("/feed");
  await expect(page.getByTestId("feed-hero-card")).toBeVisible({ timeout: 15_000 });
}

test("Inicio en celular: hero de comercio verificado y «Cerca tuyo» con uno verificado y otro no", async ({ page }) => {
  await feedMovil(page, [
    shift("s1", "Bar Verificado", true),
    shift("s2", "Bar Cercano Verificado", true),
    shift("s3", "Bar Común", false),
  ]);
  const hero = page.getByTestId("feed-hero-card");
  await expect(hero.getByText("Comercio verificado", { exact: true })).toHaveCount(1);
  const cerca = page.getByTestId("feed-nearby-card");
  await expect(cerca).toHaveCount(2);
  await expect(cerca.filter({ hasText: "Bar Cercano Verificado" }).getByRole("img", { name: "Comercio verificado" })).toHaveCount(1);
  await expect(cerca.filter({ hasText: "Bar Común" }).getByRole("img", { name: "Comercio verificado" })).toHaveCount(0);
});

test("Inicio en celular: hero de comercio sin verificar no lleva sello", async ({ page }) => {
  await feedMovil(page, [shift("s1", "Bar Común", false), shift("s2", "Bar Cercano Verificado", true)]);
  await expect(page.getByTestId("feed-hero-card").getByText("Comercio verificado")).toHaveCount(0);
  await expect(page.getByRole("img", { name: "Comercio verificado" })).toHaveCount(1);
});

test("postulantes con nombre largo: el sello se adapta al ancho, sin desborde y sin pisar «Asignar»", async ({ page }) => {
  const largo = "Maximiliano Alejandro Fernandez de la Cruz Sanchez Villa";
  await base(page, EMPLOYER);
  await page.route("**/api/v1/shifts/shift-1", (r) => r.fulfill(json({}, 404)));
  await page.route("**/api/v1/applications/shifts/shift-1", (r) =>
    r.fulfill(json([applicant("wp-1", largo, true), applicant("wp-2", largo + " Dos", true)]))
  );
  await page.route("**/api/v1/shifts/shift-1/candidates", (r) => r.fulfill(json([])));

  // Desde 390 px el chip entero; de 360 a 389 px «Verificada» con el escudo;
  // por debajo de 360 px el escudo solo. En los tres casos el nombre accesible
  // es «Identidad verificada» y en el árbol hay uno solo por tarjeta.
  const casos = [
    { width: 390, visible: "Identidad verificada", imgs: 0 },
    { width: 389, visible: "Verificada", imgs: 2 },
    { width: 360, visible: "Verificada", imgs: 2 },
    { width: 359, visible: null, imgs: 2 },
    { width: 320, visible: null, imgs: 2 },
  ];
  for (const { width, visible, imgs } of casos) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/shifts/shift-1/candidates");
    await expect(page.getByText(largo, { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    const textoEntero = page.locator("text=Identidad verificada").locator("visible=true");
    const textoCorto = page.getByText("Verificada", { exact: true }).locator("visible=true");
    await expect(textoEntero).toHaveCount(visible === "Identidad verificada" ? 2 : 0);
    await expect(textoCorto).toHaveCount(visible === "Verificada" ? 2 : 0);
    await expect(page.getByRole("img", { name: "Identidad verificada" })).toHaveCount(imgs);
    const m = await page.evaluate(() => {
      const rect = (e: Element) => e.getBoundingClientRect();
      return {
        scrollW: document.documentElement.scrollWidth,
        cards: Array.from(document.querySelectorAll("div.no-select")).map((c) => {
          const chip = Array.from(c.querySelectorAll("span"))
            .filter((e) => /^(Identidad )?verificada$/i.test((e.textContent ?? "").trim()) || e.getAttribute("role") === "img")
            .map(rect)
            .find((r) => r.width > 0)!;
          const btn = rect(c.querySelector("button")!);
          const card = rect(c);
          return { chipRight: chip.right, btnLeft: btn.left, btnRight: btn.right, cardRight: card.right };
        }),
      };
    });
    expect(m.scrollW, `scroll horizontal a ${width}px`).toBeLessThanOrEqual(width);
    expect(m.cards).toHaveLength(2);
    for (const c of m.cards) {
      expect(c.chipRight, `el sello no pisa «Asignar» a ${width}px`).toBeLessThanOrEqual(c.btnLeft);
      expect(c.btnRight).toBeLessThanOrEqual(c.cardRight);
    }
  }
});
