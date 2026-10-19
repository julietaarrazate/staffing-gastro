import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * Perfil = cómo te ven (sobrecarga visual, 2026-09-30). El formulario de
 * edición y los ajustes de la app salieron de `/profile` a sus propias
 * pantallas, y a quien todavía no completó ningún turno no se le muestran
 * métricas en cero.
 */

const WORKER_SESSION = {
  id: "user-1",
  email: "nuevo@staffya.com",
  full_name: "Trabajador Nuevo",
  role: "worker",
  status: "activo",
  is_active: true,
  is_verified: false,
};

const WORKER_PROFILE = {
  id: "profile-1",
  user_id: "user-1",
  full_name: "Trabajador Nuevo",
  photo_url: null,
  birth_date: null,
  age: null,
  city: "Palermo, CABA",
  bio: null,
  latitude: -34.5875,
  longitude: -58.4257,
  skills: ["mozo"],
  years_experience: 1,
  languages: [],
  certifications: [],
  cv_url: null,
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

async function mockWorker(page: Page) {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  const json = (body: unknown) => ({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
  await page.route("**/api/v1/auth/me", (route) => route.fulfill(json(WORKER_SESSION)));
  await page.route("**/api/v1/workers/me/profile", (route) => route.fulfill(json(WORKER_PROFILE)));
  await page.route("**/api/v1/workers/me/earnings", (route) =>
    route.fulfill(json({ total_earned: "0", this_month_earned: "0", shifts_completed: 0 }))
  );
  await page.route("**/api/v1/reviews/received", (route) => route.fulfill(json([])));
  await page.route("**/api/v1/identity/me", (route) => route.fulfill(json({ claims: [] })));
}

test("sin turnos completados, el perfil no muestra métricas en cero", async ({ page }) => {
  await mockWorker(page);
  await page.goto("/profile");

  await expect(page.getByText("Tu reputación arranca con tu primer turno.")).toBeVisible();
  await expect(page.getByText("Ganado este mes")).toHaveCount(0);
  await expect(page.getByText("Puntualidad")).toHaveCount(0);
  await expect(page.getByText("Cancelaciones")).toHaveCount(0);
  // Sin reseñas no hay sección que lo diga.
  await expect(page.getByText("Reseñas recibidas")).toHaveCount(0);
  // El formulario y los ajustes ya no están acá.
  await expect(page.getByText("Idiomas")).toHaveCount(0);
  await expect(page.getByText("Cerrar sesión")).toHaveCount(0);
  // La verificación de identidad sí: es lo que destraba todo.
  await expect(page.getByText("Verificación de identidad")).toBeVisible();
});

test("'Editar perfil' lleva al formulario, y se vuelve al perfil", async ({ page }) => {
  await mockWorker(page);
  await page.goto("/profile");

  await page.getByRole("link", { name: "Editar perfil" }).click();
  await expect(page).toHaveURL("/profile/edit");
  await expect(page.getByRole("heading", { name: "Editar perfil" })).toBeVisible();
  await expect(page.getByText("Idiomas")).toBeVisible();
  await expect(page.getByRole("button", { name: "Guardar cambios" })).toBeVisible();

  await page.getByRole("link", { name: "Perfil" }).first().click();
  await expect(page).toHaveURL("/profile");
});

test("'Ajustes' junta apariencia, soporte y cerrar sesión", async ({ page }) => {
  await mockWorker(page);
  await page.goto("/profile");

  await page.getByRole("link", { name: "Ajustes" }).click();
  await expect(page).toHaveURL("/profile/settings");
  await expect(page.getByText("Apariencia")).toBeVisible();
  await expect(page.getByRole("link", { name: "Soporte" })).toHaveAttribute("href", "/support");
  await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
});

test("Ajustes respeta el modo oscuro (la pantalla no rompe la hidratación)", async ({ page }) => {
  await mockWorker(page);
  await page.addInitScript(() => localStorage.setItem("oido-theme", "dark"));
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/profile/settings");
  await expect(page.getByRole("heading", { name: "Ajustes" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(errors).toEqual([]);
});

test("'Invitá a tu comercio' comparte el alta de comercio", async ({ page }) => {
  await mockWorker(page);
  // El share sheet nativo no existe en el navegador de test: se lo reemplaza
  // por uno que guarda lo que se le pasó.
  await page.addInitScript(() => {
    (window as unknown as { __shared: unknown[] }).__shared = [];
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: (data: unknown) => {
        (window as unknown as { __shared: unknown[] }).__shared.push(data);
        return Promise.resolve();
      },
    });
  });
  await page.goto("/profile");

  await page.getByRole("button", { name: "Invitá a tu comercio" }).click();
  const shared = await page.evaluate(
    () => (window as unknown as { __shared: { text: string }[] }).__shared
  );
  expect(shared).toHaveLength(1);
  expect(shared[0].text).toContain("https://www.oido.com.ar/register?rol=comercio");
});
