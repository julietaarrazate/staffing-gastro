import { test, expect } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * El aviso flotante (toast) no intercepta toques (prueba de punta a punta
 * 2026-11, U009): al terminar «Completar» con la IA aparece el aviso
 * «Completamos todo…» a la altura del botón «Publicar turno» (390×844) y un
 * toque enseguida caía en el aviso y no publicaba.
 */
test("con el aviso de «Completamos todo» visible, un toque en «Publicar turno» publica", async ({
  page,
}) => {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);

  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "user-2",
        email: "demo.palermo@staffya.com",
        full_name: "Comercio Demo",
        role: "employer",
        status: "activo",
        is_active: true,
        is_verified: true,
      }),
    })
  );
  await page.route("**/api/v1/shifts/parse-text", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        position: "mozo",
        start_at: "2026-08-15T20:00:00-03:00",
        end_at: "2026-08-16T02:00:00-03:00",
        pay_amount: "45000",
        urgent: false,
        meal: false,
        tips: true,
        dress_code: null,
      }),
    })
  );
  await page.route("**/api/v1/companies/me/profile", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "company-1",
        user_id: "user-2",
        name: "Bar Ejemplo",
        logo_url: null,
        category: null,
        description: null,
        address: "Calle Falsa 123, Palermo",
        city: "Palermo, CABA",
        latitude: -34.5889,
        longitude: -58.4306,
        capacity: null,
        opening_hours: null,
        rating: 0,
        events_published: 0,
        on_time_payment_rate: 0,
        late_cancellations: 0,
      }),
    })
  );
  let publicados = 0;
  await page.route("**/api/v1/shifts", (route) => {
    if (route.request().method() === "POST") {
      publicados += 1;
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: "shift-aviso-1" }),
      });
    }
    return route.continue();
  });
  await page.route("**/api/v1/shifts/shift-aviso-1/publish", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  );

  await page.goto("/shifts/new");
  await page
    .getByPlaceholder("Ej: necesito un mozo el sábado a la noche, se paga 45000")
    .fill("necesito un mozo el sábado a la noche, se paga 45000");
  await page.getByRole("button", { name: "Completar" }).click();

  // El aviso está en pantalla, y el botón de publicar también.
  const aviso = page.getByRole("status").getByText("Completamos todo — revisá la zona y publicá");
  await expect(aviso).toBeVisible();
  const publicar = page.getByRole("button", { name: "Publicar turno" });
  await expect(publicar).toBeVisible();

  // Hay que dejar que termine la animación de entrada del aviso (sube 20 px):
  // recién ahí está donde se queda los ~3 s.
  await page.waitForTimeout(600);
  await expect(aviso).toBeVisible();

  const caja = await publicar.boundingBox();
  const avisoCaja = await aviso.boundingBox();
  expect(caja).not.toBeNull();
  expect(avisoCaja).not.toBeNull();
  const x = caja!.x + caja!.width / 2;
  const y = caja!.y + caja!.height / 2;

  // El aviso realmente cae sobre el punto del toque (si no, la prueba no
  // prueba nada): sus cajas se pisan.
  const pisa =
    x >= avisoCaja!.x &&
    x <= avisoCaja!.x + avisoCaja!.width &&
    y >= avisoCaja!.y &&
    y <= avisoCaja!.y + avisoCaja!.height;
  expect(pisa, "el aviso debe quedar encima del botón para que la prueba valga").toBe(true);

  // Toque con las coordenadas reales del botón, sin click forzado.
  const alta = page.waitForRequest(
    (req) => req.method() === "POST" && new URL(req.url()).pathname.endsWith("/api/v1/shifts"),
    { timeout: 5000 }
  );
  const publish = page.waitForRequest(
    (req) =>
      req.method() === "POST" &&
      new URL(req.url()).pathname.endsWith("/api/v1/shifts/shift-aviso-1/publish"),
    { timeout: 5000 }
  );
  await page.mouse.click(x, y);
  await alta;
  await publish;
  expect(publicados).toBe(1);
  // El aviso seguía en pantalla al tocar: el toque atravesó el aviso, no lo cerró.
  await expect(aviso).toBeVisible();
});
