import { test, expect } from "@playwright/test";
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
  const feedDemorado = new Promise<void>((res) => (soltarFeed = res));
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
});
