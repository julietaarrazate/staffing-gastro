import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * `/bienvenida` del trabajador cuando el perfil YA existe (la persona vuelve
 * a entrar a la URL del onboarding): el POST da 409 y antes caía a un PUT con
 * un payload corto, que REEMPLAZA el perfil entero y borraba descripción, CV,
 * idiomas y fecha de nacimiento. «Dejar para después» no tiene que escribir
 * nada si el perfil ya está.
 */
async function prepararSesion(page: Page) {
  await skipSplash(page);
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
}

test("«Dejar para después» con el perfil ya creado no lo reemplaza", async ({ page }) => {
  await prepararSesion(page);
  const metodos: string[] = [];
  await page.route("**/api/v1/workers/me/profile", (route) => {
    const req = route.request();
    metodos.push(req.method());
    if (req.method() === "POST") {
      return route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ detail: "El perfil de trabajador ya existe" }),
      });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.goto("/bienvenida");
  await page.getByRole("button", { name: /Dejar para después/ }).click();
  await page.waitForURL("**/feed");

  expect(metodos).toContain("POST");
  expect(metodos).not.toContain("PUT");
});

const PERFIL_EXISTENTE = {
  id: "profile-1",
  user_id: "user-1",
  full_name: "Mozo Demo",
  photo_url: "https://cdn.example/foto.jpg",
  birth_date: "1990-05-04",
  age: 36,
  city: "Otra zona",
  latitude: -34.6,
  longitude: -58.4,
  bio: "Descripción guardada",
  skills: ["cocinero"],
  years_experience: 5,
  languages: ["Inglés"],
  certifications: [],
  cv_url: "https://cdn.example/cv.pdf",
  cv_filename: "CV-Guardado.pdf",
  is_available: false,
  rating: 0,
  events_completed: 0,
  punctuality_rate: 0,
  cancellations: 0,
  no_shows: 0,
  badges: [],
  level: "bronce",
  identidad_verificada: false,
};

async function completarAsistente(page: Page, ruta = "/bienvenida") {
  await page.goto(ruta);
  await page.locator("select").nth(1).selectOption({ index: 1 });
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Mozo/a" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Ver turnos cerca mío" }).click();
  await page.waitForURL("**/feed");
}

function mockPerfilExistente(page: Page, puts: Record<string, unknown>[]) {
  return page.route("**/api/v1/workers/me/profile", (route) => {
    const req = route.request();
    if (req.method() === "POST") {
      return route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ detail: "El perfil de trabajador ya existe" }),
      });
    }
    if (req.method() === "PUT") {
      const body = req.postDataJSON();
      puts.push(body);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...PERFIL_EXISTENTE, ...body }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(PERFIL_EXISTENTE) });
  });
}

test("terminar el asistente con el perfil ya creado guarda sólo lo que capturó y conserva lo demás", async ({ page }) => {
  await prepararSesion(page);
  const puts: Record<string, unknown>[] = [];
  await mockPerfilExistente(page, puts);

  await completarAsistente(page);

  const primero = puts[0];
  expect(primero).toMatchObject({
    bio: "Descripción guardada",
    cv_url: "https://cdn.example/cv.pdf",
    cv_filename: "CV-Guardado.pdf",
    languages: ["Inglés"],
    birth_date: "1990-05-04",
    photo_url: "https://cdn.example/foto.jpg",
    is_available: false,
    years_experience: 5,
    skills: ["mozo"],
  });
  expect(primero.city).not.toBe("Otra zona");
});

test("la cuenta invitada (?invitado=1) sí reemplaza el perfil: cada probador arranca de cero", async ({ page }) => {
  await prepararSesion(page);
  const puts: Record<string, unknown>[] = [];
  await mockPerfilExistente(page, puts);

  await completarAsistente(page, "/bienvenida?invitado=1");

  expect(puts).toHaveLength(1);
  expect(puts[0]).toMatchObject({ photo_url: null, is_available: true });
  expect(puts[0]).not.toHaveProperty("bio");
  expect(puts[0]).not.toHaveProperty("cv_url");
});
