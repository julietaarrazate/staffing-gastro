import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * Panel del comercio en tablet (auditoría visual 2026-09-24, A3).
 *
 * Antes cada familia de estado abría su propia grilla en una fila nueva: con
 * un turno por familia, a 768px quedaba una tarjeta de 360px y media pantalla
 * vacía, grupo tras grupo. Ahora las familias comparten la grilla y dos de un
 * turno cada una van lado a lado.
 *
 * Y el pago: a 39px (`text-price`) el monto no deja lugar a los chips
 * "+ propinas"/"+ comida" en una tarjeta de ~320px, y con `shrink-0` se
 * salían por el borde de la tarjeta. Tienen que bajar de línea.
 */

const SESSION = {
  id: "u-e",
  email: "e@oido.test",
  full_name: "Bar La Esquina",
  role: "employer",
  status: "activo",
  is_active: true,
  is_verified: true,
};

function shift(id: string, status: string, position: string) {
  return {
    id,
    company_id: "c1",
    position,
    quantity: 1,
    start_at: "2030-07-20T20:00:00-03:00",
    end_at: "2030-07-21T02:00:00-03:00",
    pay_amount: "148000",
    currency: "ARS",
    tips: true,
    meal: true,
    dress_code: null,
    urgent: false,
    address: null,
    city: "Palermo, CABA",
    latitude: null,
    longitude: null,
    title: null,
    description: null,
    status,
    worker_profile_id: status === "asignado" ? "wp1" : null,
    created_at: "2030-07-01T12:00:00-03:00",
    company_name: "Bar La Esquina",
    company_logo_url: null,
  };
}

async function setup(page: Page) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  // Catch-all primero: Playwright resuelve la última ruta registrada.
  await page.route("**/api/v1/**", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
      : route.continue()
  );
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(SESSION) })
  );
  await page.route("**/api/v1/shifts/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([shift("s1", "publicado", "bartender"), shift("s2", "asignado", "mozo")]),
    })
  );
}

test("a 768px dos familias de un turno cada una comparten la fila", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await setup(page);
  await page.goto("/shifts");
  const buscando = page.locator('[data-family="buscando"]');
  const enMarcha = page.locator('[data-family="en_marcha"]');
  await expect(buscando).toBeVisible();
  await expect(enMarcha).toBeVisible();
  const a = (await buscando.boundingBox())!;
  const b = (await enMarcha.boundingBox())!;
  expect(Math.abs(a.y - b.y)).toBeLessThan(2);
  expect(b.x).toBeGreaterThan(a.x + a.width - 1);
});

for (const width of [768, 1440]) {
  test(`a ${width}px nada del bloque del pago se sale de la tarjeta`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await setup(page);
    await page.goto("/shifts");
    await expect(page.locator('[data-family="buscando"]')).toBeVisible();
    const desbordes = await page.evaluate(() => {
      const out: string[] = [];
      for (const section of Array.from(document.querySelectorAll("[data-family]"))) {
        for (const chip of Array.from(section.querySelectorAll("span"))) {
          if (!/\+ (propinas|comida)/.test(chip.textContent ?? "")) continue;
          // La tarjeta es el primer ancestro con overflow oculto o borde redondeado.
          let card: HTMLElement | null = chip.parentElement;
          while (card && getComputedStyle(card).overflow !== "hidden" && !card.className.includes("ring-")) {
            card = card.parentElement;
          }
          if (!card) continue;
          const c = card.getBoundingClientRect();
          const r = chip.getBoundingClientRect();
          if (r.right > c.right + 0.5) out.push(`${chip.textContent} (${Math.round(r.right)} > ${Math.round(c.right)})`);
        }
      }
      return out;
    });
    expect(desbordes).toEqual([]);
  });
}
