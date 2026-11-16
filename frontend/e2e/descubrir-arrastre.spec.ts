import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * G20 (U069) · en «Descubrir rápido» deslizar la tarjeta pasa a la siguiente
 * (o la deja donde estaba) y NUNCA abre el detalle; sólo un toque quieto lo
 * abre. El teclado y el lector de pantalla llegan con un botón propio.
 */

const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

function shift(id: string, position: string, company: string) {
  return {
    id,
    company_id: "company-1",
    position,
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

async function abrirMazo(page: Page) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) =>
    r.fulfill(
      json({
        id: "user-1",
        email: "demo.mozo@staffya.com",
        full_name: "Mozo Demo",
        role: "worker",
        status: "activo",
        is_active: true,
        is_verified: true,
      }),
    ),
  );
  await page.route("**/api/v1/shifts/feed", (r) =>
    r.fulfill(json([shift("s1", "mozo", "Bar Uno"), shift("s2", "bartender", "Café Dos"), shift("s3", "cocinero", "Parrilla Tres")])),
  );
  await page.route("**/api/v1/applications/mine", (r) => r.fulfill(json([])));
  await page.goto("/feed");
  await page.getByRole("button", { name: /Descubrir rápido/ }).click();
  const dialog = page.getByRole("dialog", { name: "Descubrir rápido" });
  await expect(dialog.getByTestId("swipe-deck-position")).toHaveText("1 de 3", { timeout: 15_000 });
  return dialog;
}

async function arrastrar(page: Page, dx: number, pasos = 8) {
  const box = (await page.getByTestId("swipe-deck-card").boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height * 0.45;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y, { steps: pasos });
  await page.mouse.up();
}

test.describe("Descubrir rápido: toque vs arrastre", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("deslizar a la izquierda pasa a la siguiente y no abre el detalle", async ({ page }) => {
    const dialog = await abrirMazo(page);
    await arrastrar(page, -180);
    await expect(dialog.getByTestId("swipe-deck-position")).toHaveText("2 de 3");
    await expect(page).toHaveURL(/\/feed$/);
  });

  test("un arrastre corto que no llega al umbral vuelve la tarjeta y no abre nada", async ({ page }) => {
    const dialog = await abrirMazo(page);
    await arrastrar(page, -40);
    await page.waitForTimeout(600);
    await expect(dialog.getByTestId("swipe-deck-position")).toHaveText("1 de 3");
    await expect(page).toHaveURL(/\/feed$/);
    // La tarjeta volvió a su lugar. La vuelta es un resorte: se espera a que
    // se asiente en vez de medir una sola vez (en CI quedó a 2,03 px a los 600 ms).
    await expect
      .poll(
        () =>
          page
            .getByTestId("swipe-deck-card")
            .evaluate((e) => Math.abs(e.getBoundingClientRect().x - e.parentElement!.getBoundingClientRect().x)),
        { timeout: 3_000 }
      )
      .toBeLessThan(1);
  });

  test("un toque quieto abre el detalle", async ({ page }) => {
    await abrirMazo(page);
    const box = (await page.getByTestId("swipe-deck-card").boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.45);
    await expect(page).toHaveURL(/\/turno\/s1$/);
  });

  test("con la página scrolleada, un toque quieto igual abre el detalle", async ({ page }) => {
    await abrirMazo(page);
    await page.evaluate(() => {
      document.body.style.minHeight = "3000px";
      window.scrollTo(0, 400);
    });
    const box = (await page.getByTestId("swipe-deck-card").boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.45);
    await expect(page).toHaveURL(/\/turno\/s1$/);
  });

  test("con el teclado se llega al detalle por el botón", async ({ page }) => {
    const dialog = await abrirMazo(page);
    await dialog.getByRole("button", { name: "Ver el detalle del turno" }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/turno\/s1$/);
  });
});
