import { test, expect, type Locator, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash, isoEnDias } from "./mocks";

/**
 * El aviso flotante (toast) no tapa los botones de acción (prueba de punta a
 * punta 2026-11, U009): al terminar «Completar» con la IA aparecía el aviso
 * «Completamos todo…» sobre «Publicar turno». Ahora va arriba, bajo el
 * encabezado, en todos los anchos, y no se cruza con el botón: ni en celular
 * (390×844) ni en escritorio con la ventana baja (1280×560, donde el botón
 * queda a media pantalla y un aviso abajo lo pisaba).
 *
 * Arriba queda sobre el botón redondo de la esquina del asistente. Tocar el
 * aviso lo cierra y el toque NO pasa a ese botón: en el primer paso es
 * «Cerrar», que saca del asistente y pierde lo cargado.
 */
const ESCRITO = "alguien para el sábado, se paga 45000";

const VIEWPORTS = [
  { nombre: "celular 390×844", width: 390, height: 844 },
  { nombre: "escritorio con ventana baja 1280×560", width: 1280, height: 560 },
];

for (const vp of VIEWPORTS) {
  test.describe(vp.nombre, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

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
        }),
      );
      await page.route("**/api/v1/shifts/parse-text", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            position: "mozo",
            start_at: isoEnDias(30, "20:00"),
            end_at: isoEnDias(31, "02:00"),
            pay_amount: "45000",
            urgent: false,
            meal: false,
            tips: true,
            dress_code: null,
          }),
        }),
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
        }),
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
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "{}",
        }),
      );

      await page.goto("/shifts/new");
      await page
        .getByPlaceholder(
          "Ej: necesito un mozo el sábado a la noche, se paga 45000",
        )
        .fill("necesito un mozo el sábado a la noche, se paga 45000");
      await page.getByRole("button", { name: "Completar" }).click();

      // El aviso está en pantalla, y el botón de publicar también.
      const aviso = page
        .getByRole("status")
        .getByText("Completamos todo — revisá la zona y publicá");
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
      expect(seCruzan, "el aviso no puede quedar sobre «Publicar turno»").toBe(
        false,
      );

      // Va arriba, debajo del encabezado (Navbar, 64 px) y dentro de la pantalla.
      const navbar = await page.locator("header").first().boundingBox();
      expect(navbar).not.toBeNull();
      expect(avisoCaja!.y).toBeGreaterThanOrEqual(navbar!.y + navbar!.height);
      expect(avisoCaja!.y + avisoCaja!.height).toBeLessThan(caja!.y);
      expect(avisoCaja!.x).toBeGreaterThanOrEqual(0);
      expect(avisoCaja!.x + avisoCaja!.width).toBeLessThanOrEqual(vp.width);

      // Tocar el aviso (en su punta izquierda, sobre el tilde: debajo está el
      // botón redondo de la esquina del asistente) lo cierra y nada más: el
      // asistente sigue en el mismo paso y no se publicó nada.
      await page.mouse.click(
        avisoCaja!.x + 14,
        avisoCaja!.y + avisoCaja!.height / 2,
      );
      await expect(aviso).toBeHidden({ timeout: 1500 });
      await expect(page).toHaveURL(/\/shifts\/new$/);
      await expect(publicar).toBeVisible();
      expect(publicados).toBe(0);

      // Un toque en «Publicar turno» publica.
      const alta = page.waitForRequest(
        (req) =>
          req.method() === "POST" &&
          new URL(req.url()).pathname.endsWith("/api/v1/shifts"),
        { timeout: 5000 },
      );
      const publish = page.waitForRequest(
        (req) =>
          req.method() === "POST" &&
          new URL(req.url()).pathname.endsWith(
            "/api/v1/shifts/shift-aviso-1/publish",
          ),
        { timeout: 5000 },
      );
      await publicar.click();
      await alta;
      await publish;
      expect(publicados).toBe(1);
    });
  });
}

/**
 * Primer paso del asistente: la IA no entendió el puesto, el aviso dice
 * «Completamos lo que pudimos…» y debajo queda el botón «Cerrar», que saca del
 * asistente y pierde lo cargado. Devuelve el aviso, el campo con lo escrito y
 * el punto del aviso más cercano al centro de «Cerrar».
 */
async function avisoSobreCerrar(page: Page) {
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
    }),
  );
  await page.route("**/api/v1/shifts/parse-text", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        position: null,
        start_at: null,
        end_at: null,
        pay_amount: "45000",
        urgent: false,
        meal: false,
        tips: false,
        dress_code: null,
      }),
    }),
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
    }),
  );

  await page.goto("/shifts/new");
  const pedido = page.getByPlaceholder(
    "Ej: necesito un mozo el sábado a la noche, se paga 45000",
  );
  await pedido.fill(ESCRITO);
  await page.getByRole("button", { name: "Completar" }).click();

  const aviso = page
    .getByRole("status")
    .getByText("Completamos lo que pudimos — seguí desde donde quedó");
  await expect(aviso).toBeVisible();
  // Que termine la entrada del aviso: recién ahí está donde se queda.
  await page.waitForTimeout(600);
  const cerrar = page.getByRole("button", { name: "Cerrar" });
  await expect(cerrar).toBeVisible();

  const avisoCaja = await aviso.boundingBox();
  const cerrarCaja = await cerrar.boundingBox();
  expect(avisoCaja).not.toBeNull();
  expect(cerrarCaja).not.toBeNull();
  const dentro = (v: number, min: number, max: number) =>
    Math.min(Math.max(v, min + 2), max - 2);
  const x = dentro(
    cerrarCaja!.x + cerrarCaja!.width / 2,
    avisoCaja!.x,
    avisoCaja!.x + avisoCaja!.width,
  );
  const y = dentro(
    cerrarCaja!.y + cerrarCaja!.height / 2,
    avisoCaja!.y,
    avisoCaja!.y + avisoCaja!.height,
  );
  return { aviso, pedido, x, y };
}

// Se cerró el aviso, no el asistente: sigue en la misma pantalla con lo que
// la persona escribió. El aviso se va solo a los 3,2 s: el plazo corto prueba
// que lo cerró el toque.
async function sigueEnElAsistente(
  page: Page,
  aviso: Locator,
  pedido: Locator,
) {
  await expect(aviso).toBeHidden({ timeout: 1500 });
  await expect(page).toHaveURL(/\/shifts\/new$/);
  await expect(pedido).toHaveValue(ESCRITO);
}

test.describe("primer paso del asistente, celular 390×844", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("tocar el aviso «Completamos lo que pudimos» lo cierra y no saca del asistente", async ({
    page,
  }) => {
    const { aviso, pedido, x, y } = await avisoSobreCerrar(page);
    await page.mouse.click(x, y);
    await sigueEnElAsistente(page, aviso, pedido);
  });
});

test.describe("primer paso del asistente, pantalla táctil 390×844", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("un toque con el dedo sobre el aviso lo cierra y no aprieta «Cerrar»", async ({
    page,
  }) => {
    const { aviso, pedido, x, y } = await avisoSobreCerrar(page);
    await page.touchscreen.tap(x, y);
    await sigueEnElAsistente(page, aviso, pedido);
  });

  test("un doble toque sobre el aviso tampoco saca del asistente", async ({
    page,
  }) => {
    const { aviso, pedido, x, y } = await avisoSobreCerrar(page);
    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(150);
    await page.touchscreen.tap(x, y);
    await sigueEnElAsistente(page, aviso, pedido);
  });
});

test.describe("primer paso del asistente, táctil y con «reducir movimiento»", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  // Con «reducir movimiento» la salida del aviso era instantánea: el segundo
  // toque de un doble toque caía sobre «Cerrar» y se perdía lo cargado.
  test("un doble toque sobre el aviso no saca del asistente", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const { aviso, pedido, x, y } = await avisoSobreCerrar(page);
    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(150);
    await page.touchscreen.tap(x, y);
    await sigueEnElAsistente(page, aviso, pedido);
  });
});
