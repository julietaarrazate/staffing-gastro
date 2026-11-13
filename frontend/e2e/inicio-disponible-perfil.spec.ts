import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * Interruptor «Disponible» del Inicio: guarda el perfil con PUT, que
 * REEMPLAZA el perfil entero. Tiene que cambiar sólo la disponibilidad:
 * - no borrar el nombre del CV (antes no mandaba `cv_filename`);
 * - no pisar lo guardado en el perfil después de que el Inicio cargó su
 *   copia (el Inicio se pinta con datos viejos y se actualiza por detrás).
 */

const PERFIL_BASE = {
  id: "profile-1",
  user_id: "user-1",
  full_name: "Mozo Demo",
  photo_url: null,
  birth_date: null,
  age: null,
  city: "Palermo, CABA",
  latitude: -34.5875,
  longitude: -58.4257,
  years_experience: 2,
  languages: [],
  certifications: [],
  is_available: true,
  rating: 0,
  events_completed: 0,
  punctuality_rate: 0,
  cancellations: 0,
  no_shows: 0,
  badges: [],
  level: "bronce",
  identidad_verificada: false,
};

const COPIA_VIEJA = {
  ...PERFIL_BASE,
  bio: "Descripción vieja",
  skills: ["mozo"],
  cv_url: null,
  cv_filename: null,
};

const EN_SERVIDOR = {
  ...PERFIL_BASE,
  bio: "Descripción nueva",
  skills: ["mozo", "barista"],
  cv_url: "https://cdn.example/cv.pdf",
  cv_filename: "CV-Vera-Datos-2026.pdf",
};

test("tocar «Disponible» cambia sólo la disponibilidad y no pisa lo guardado en el perfil", async ({ page }) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);

  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "user-1",
        email: "demo@staffya.com",
        full_name: "Mozo Demo",
        role: "worker",
        status: "activo",
        is_active: true,
        is_verified: true,
      }),
    })
  );
  await page.route("**/api/v1/shifts/feed**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/v1/applications/mine", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  // Hasta que el Inicio terminó de cargar, el servidor devuelve la copia
  // vieja; después, lo que la persona guardó mientras tanto en otra pestaña.
  let guardadoEnOtraPestana = false;
  let putBody: Record<string, unknown> | null = null;
  await page.route("**/api/v1/workers/me/profile", async (route) => {
    const req = route.request();
    if (req.method() === "PUT") {
      putBody = req.postDataJSON();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...EN_SERVIDOR, ...putBody }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(guardadoEnOtraPestana ? EN_SERVIDOR : COPIA_VIEJA),
    });
  });

  await page.goto("/feed");
  const interruptor = page.getByRole("button", { name: "Cambiar disponibilidad" });
  await expect(interruptor).toBeVisible();
  await expect(page.getByText("Disponible", { exact: true })).toBeVisible();

  guardadoEnOtraPestana = true;
  await interruptor.click();

  await expect(page.getByText("No disp.")).toBeVisible();
  await expect.poll(() => putBody).not.toBeNull();
  expect(putBody).toMatchObject({
    is_available: false,
    bio: "Descripción nueva",
    skills: ["mozo", "barista"],
    cv_url: "https://cdn.example/cv.pdf",
    cv_filename: "CV-Vera-Datos-2026.pdf",
  });
});

test("tocar «Disponible» con el refresco del Inicio en vuelo: la pantalla se queda con lo guardado", async ({ page }) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);

  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "user-1",
        email: "demo@staffya.com",
        full_name: "Mozo Demo",
        role: "worker",
        status: "activo",
        is_active: true,
        is_verified: true,
      }),
    })
  );
  // El feed (el pedido más lento de la carga del Inicio) queda demorado hasta
  // que se lo suelta: simula la conexión lenta.
  let soltarFeed!: () => void;
  let feedDemorado = new Promise<void>((res) => (soltarFeed = res));
  await page.route("**/api/v1/shifts/feed**", async (route) => {
    await feedDemorado;
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/v1/applications/mine", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  let enServidor = { ...EN_SERVIDOR };
  const puts: Record<string, unknown>[] = [];
  await page.route("**/api/v1/workers/me/profile", async (route) => {
    const req = route.request();
    if (req.method() === "PUT") {
      const body = req.postDataJSON();
      puts.push(body);
      enServidor = { ...enServidor, ...body };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(enServidor) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(enServidor) });
  });

  await page.goto("/feed");
  const interruptor = page.getByRole("button", { name: "Cambiar disponibilidad" });
  await expect(interruptor).toBeVisible();
  await interruptor.click();
  await expect(page.getByText("No disp.")).toBeVisible();
  await expect.poll(() => puts.length).toBe(1);

  // Recién ahora termina la carga que arrancó antes del toque: no puede
  // deshacer lo guardado.
  soltarFeed();
  await page.waitForTimeout(500);
  await expect(page.getByText("No disp.")).toBeVisible();
  expect(puts).toHaveLength(1);
  expect(puts[0]).toMatchObject({ is_available: false, cv_filename: "CV-Vera-Datos-2026.pdf" });

  // Tocó antes de que existiera caché de pantalla (primera carga): al ir a
  // otra pestaña y volver, el Inicio se pinta desde caché y tiene que seguir
  // mostrando lo guardado, no una copia sin perfil.
  await page.getByRole("link", { name: "Perfil" }).first().click();
  await expect(page).toHaveURL("/profile");
  // El refresco de la vuelta también queda demorado: mientras tanto sólo hay
  // caché para pintar.
  feedDemorado = new Promise<void>((res) => (soltarFeed = res));
  await page.getByRole("link", { name: "Inicio" }).first().click();
  await expect(page).toHaveURL("/feed");
  await expect(page.getByText("No disp.")).toBeVisible();
  soltarFeed();
});

test("si el guardado falla con la carga del Inicio en vuelo, la pantalla toma el perfil del servidor", async ({ page }) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);

  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "user-1",
        email: "demo@staffya.com",
        full_name: "Mozo Demo",
        role: "worker",
        status: "activo",
        is_active: true,
        is_verified: true,
      }),
    })
  );
  let soltarFeed!: () => void;
  const feedDemorado = new Promise<void>((res) => (soltarFeed = res));
  await page.route("**/api/v1/shifts/feed**", async (route) => {
    await feedDemorado;
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/v1/applications/mine", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  // El servidor ya tiene «No disp.»; el guardado falla.
  const enServidor = { ...EN_SERVIDOR, is_available: false };
  let puts = 0;
  let soltarPut!: () => void;
  const putDemorado = new Promise<void>((res) => (soltarPut = res));
  await page.route("**/api/v1/workers/me/profile", async (route) => {
    if (route.request().method() === "PUT") {
      puts += 1;
      await putDemorado;
      return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ detail: "Error" }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(enServidor) });
  });

  await page.goto("/feed");
  const interruptor = page.getByRole("button", { name: "Cambiar disponibilidad" });
  await expect(interruptor).toBeVisible();
  await interruptor.click();
  await expect.poll(() => puts).toBe(1);

  // La carga termina con el guardado todavía en vuelo (no aplica su perfil) y
  // recién después el guardado falla: el perfil que trajo la carga no se pierde.
  soltarFeed();
  await page.waitForTimeout(500);
  soltarPut();
  await expect(page.getByText("No se pudo actualizar tu disponibilidad")).toBeVisible();
  await expect(page.getByText("No disp.")).toBeVisible();
});

const TURNO = {
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
  status: "publicado",
  worker_profile_id: null,
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

async function prepararInicioConUnTurno(page: Page) {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "user-1",
        email: "demo@staffya.com",
        full_name: "Mozo Demo",
        role: "worker",
        status: "activo",
        is_active: true,
        is_verified: true,
      }),
    })
  );
  await page.route("**/api/v1/applications/mine", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
}

test("si el guardado falla sin conexión, el Inicio conserva los turnos y sólo avisa el error", async ({ page }) => {
  await prepararInicioConUnTurno(page);
  let sinRed = false;
  let pedidosFeed = 0;
  await page.route("**/api/v1/shifts/feed**", (route) => {
    pedidosFeed += 1;
    if (sinRed) return route.abort("failed");
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([TURNO]) });
  });
  await page.route("**/api/v1/workers/me/profile", (route) => {
    if (sinRed) return route.abort("failed");
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(EN_SERVIDOR) });
  });

  await page.goto("/feed");
  await expect(page.getByText("Bar Demo Palermo").first()).toBeVisible();
  const interruptor = page.getByRole("button", { name: "Cambiar disponibilidad" });
  await expect(interruptor).toBeVisible();
  const feedAntes = pedidosFeed;

  sinRed = true;
  await interruptor.click();

  await expect(page.getByText("No se pudo actualizar tu disponibilidad")).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByText("Bar Demo Palermo").first()).toBeVisible();
  await expect(page.getByText("No se pudo cargar")).toHaveCount(0);
  expect(pedidosFeed).toBe(feedAntes);
  await expect(page.getByText("Disponible", { exact: true })).toBeVisible();
});

test("si todavía no hay perfil, tocar «Disponible» explica que falta completarlo y no recarga el Inicio", async ({ page }) => {
  await prepararInicioConUnTurno(page);
  let pedidosFeed = 0;
  await page.route("**/api/v1/shifts/feed**", (route) => {
    pedidosFeed += 1;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([TURNO]) });
  });
  await page.route("**/api/v1/workers/me/profile", (route) =>
    route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "Perfil no encontrado" }) })
  );

  await page.goto("/feed");
  await expect(page.getByText("Bar Demo Palermo").first()).toBeVisible();
  const interruptor = page.getByRole("button", { name: "Cambiar disponibilidad" });
  await expect(interruptor).toBeVisible();
  const feedAntes = pedidosFeed;

  await interruptor.click();

  await expect(page.getByText("Completá tu perfil para marcarte disponible")).toBeVisible();
  await page.waitForTimeout(500);
  expect(pedidosFeed).toBe(feedAntes);
  await expect(page.getByText("Bar Demo Palermo").first()).toBeVisible();
});
