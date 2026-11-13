import { test, expect } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * El aviso flotante (toast) no tapa los botones de acción (prueba de punta a
 * punta 2026-11, U009): al terminar «Completar» con la IA aparecía el aviso
 * «Completamos todo…» sobre «Publicar turno» (390×844). Ahora, en pantallas
 * angostas, va arriba bajo el encabezado y no se cruza con el botón.
 */
test("con el aviso de «Completamos todo» visible, el aviso no tapa «Publicar turno» y un toque en el botón publica", async ({
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

  // Dejar que termine la animación de entrada (opacidad y escala): recién ahí
  // está donde se queda los ~3 s.
  await page.waitForTimeout(600);
  await expect(aviso).toBeVisible();

  const caja = await publicar.boundingBox();
  const avisoCaja = await aviso.boundingBox();
  expect(caja).not.toBeNull();
  expect(avisoCaja).not.toBeNull();

  // El aviso NO se superpone con «Publicar turno»: cajas que no se cruzan.
  const seCruzan =
    avisoCaja!.x < caja!.x + caja!.width &&
    avisoCaja!.x + avisoCaja!.width > caja!.x &&
    avisoCaja!.y < caja!.y + caja!.height &&
    avisoCaja!.y + avisoCaja!.height > caja!.y;
  expect(seCruzan, "el aviso no puede quedar sobre «Publicar turno»").toBe(false);

  // Va arriba, debajo del encabezado (Navbar, 64 px) y dentro de la pantalla.
  const navbar = await page.locator("header").first().boundingBox();
  expect(navbar).not.toBeNull();
  expect(avisoCaja!.y).toBeGreaterThanOrEqual(navbar!.y + navbar!.height);
  expect(avisoCaja!.y + avisoCaja!.height).toBeLessThan(caja!.y);
  expect(avisoCaja!.x).toBeGreaterThanOrEqual(0);
  expect(avisoCaja!.x + avisoCaja!.width).toBeLessThanOrEqual(390);

  // Lo que queda debajo del aviso se puede tocar: el aviso no recibe punteros.
  const x = avisoCaja!.x + avisoCaja!.width / 2;
  const y = avisoCaja!.y + avisoCaja!.height / 2;
  const capturaPunteros = await page.evaluate(
    ([px, py]) => !!document.elementFromPoint(px, py)?.closest('[role="status"]'),
    [x, y]
  );
  expect(capturaPunteros, "el aviso no debe capturar punteros").toBe(false);

  // Un toque en «Publicar turno» publica.
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
  await publicar.click();
  await alta;
  await publish;
  expect(publicados).toBe(1);
});
