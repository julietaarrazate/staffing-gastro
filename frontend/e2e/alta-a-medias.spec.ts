import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * G12 (U034, U035): la cuenta existe pero su perfil no (se cortó la
 * bienvenida). Las respuestas son las REALES del backend:
 * - `GET /workers/me/profile` sin perfil → 404 `{"detail": "Todavía no creaste tu perfil de trabajador"}`
 * - `GET /companies/me/profile` sin perfil → 404 `{"detail": "Todavía no creaste tu perfil de comercio"}`
 * - `GET /shifts/me` (panel) sin perfil de comercio → 400 `{"detail": "Primero creá tu perfil de comercio para publicar turnos"}`
 * - `POST /…/me/profile` con perfil ya creado → 409
 */
const json = (status: number, body: unknown) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});
const SIN_PERFIL_TRABAJADOR = json(404, { detail: "Todavía no creaste tu perfil de trabajador" });
const SIN_PERFIL_COMERCIO = json(404, { detail: "Todavía no creaste tu perfil de comercio" });
const PANEL_SIN_COMERCIO = json(400, { detail: "Primero creá tu perfil de comercio para publicar turnos" });

const cuenta = (role: "worker" | "employer" | "admin", email = `${role}@staffya.com`) => ({
  id: `user-${role}`,
  email,
  full_name: "Persona Demo",
  role,
  status: "activo",
  is_active: true,
  is_verified: true,
});

async function base(page: Page, role: "worker" | "employer" | "admin", email?: string) {
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json(200, cuenta(role, email))));
  await page.route("**/api/v1/auth/login", (r) =>
    r.fulfill(json(200, { access_token: "e2e-access-token", token_type: "bearer", user: cuenta(role, email) })),
  );
  await page.route("**/api/v1/shifts/feed**", (r) => r.fulfill(json(200, [])));
  await page.route("**/api/v1/applications/mine", (r) => r.fulfill(json(200, [])));
  await page.route("**/api/v1/shifts/me", (r) => r.fulfill(json(200, [])));
}

async function ingresar(page: Page, url: string) {
  await page.goto(url);
  await page.getByPlaceholder("Email").fill("persona@staffya.com");
  await page.getByPlaceholder("Contraseña").fill("unaClaveLarga1");
  await page.getByRole("button", { name: "Ingresar" }).click();
}

const PERFIL_TRABAJADOR = {
  id: "p1",
  user_id: "user-worker",
  full_name: "Persona Demo",
  photo_url: null,
  birth_date: null,
  age: null,
  city: "Palermo, CABA",
  latitude: -34.58,
  longitude: -58.43,
  bio: null,
  skills: ["mozo"],
  years_experience: 2,
  languages: [],
  certifications: [],
  cv_url: null,
  cv_filename: null,
  is_available: true,
};

test.describe("al ingresar", () => {
  test("trabajador sin perfil cae en /bienvenida y conserva el next", async ({ page }) => {
    await base(page, "worker");
    await page.route("**/api/v1/workers/me/profile", (r) => r.fulfill(SIN_PERFIL_TRABAJADOR));
    await ingresar(page, "/login?next=%2Fturno%2Fabc");
    await expect(page).toHaveURL(/\/bienvenida\?next=%2Fturno%2Fabc$/);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  });

  test("comercio sin perfil cae en /bienvenida", async ({ page }) => {
    await base(page, "employer");
    await page.route("**/api/v1/companies/me/profile", (r) => r.fulfill(SIN_PERFIL_COMERCIO));
    await ingresar(page, "/login");
    await expect(page).toHaveURL(/\/bienvenida$/);
    await expect(page.getByLabel("Nombre del comercio")).toBeVisible();
  });

  test("con perfil sigue al destino de siempre", async ({ page }) => {
    await base(page, "worker");
    await page.route("**/api/v1/workers/me/profile", (r) => r.fulfill(json(200, PERFIL_TRABAJADOR)));
    await ingresar(page, "/login");
    await page.waitForURL("**/feed");
    await expect(page).not.toHaveURL(/bienvenida/);
  });

  test("el admin nunca va a la bienvenida ni se le consulta un perfil", async ({ page }) => {
    await base(page, "admin");
    const pedidos: string[] = [];
    page.on("request", (req) => {
      if (/\/(workers|companies)\/me\/profile/.test(req.url())) pedidos.push(req.url());
    });
    await ingresar(page, "/login");
    await page.waitForURL(/\/admin/);
    expect(pedidos).toEqual([]);
  });
});

test.describe("Inicio y panel", () => {
  test("Inicio del trabajador sin perfil: «Te falta completar tu perfil» con su botón", async ({ page }) => {
    await injectSession(page);
    await base(page, "worker");
    await page.route("**/api/v1/workers/me/profile", (r) => r.fulfill(SIN_PERFIL_TRABAJADOR));
    await page.goto("/feed");
    const cartel = page.getByTestId("perfil-faltante");
    await expect(cartel.getByRole("heading", { name: "Te falta completar tu perfil" })).toBeVisible();
    await cartel.getByRole("link", { name: "Completar mi perfil" }).click();
    await expect(page).toHaveURL(/\/bienvenida\?next=%2Ffeed$/);
  });

  test("trabajador sin zona u oficio: cartel fijo; completo: sin cartel", async ({ page }) => {
    await injectSession(page);
    await base(page, "worker");
    let perfil: Record<string, unknown> = { ...PERFIL_TRABAJADOR, latitude: null, longitude: null, skills: [] };
    await page.route("**/api/v1/workers/me/profile", (r) => r.fulfill(json(200, perfil)));
    await page.goto("/feed");
    await expect(page.getByText("Completá tu zona y tus oficios para recibir turnos")).toBeVisible();
    await page.getByRole("link", { name: "Completar mi perfil" }).click();
    await expect(page).toHaveURL(/\/profile$/);

    perfil = PERFIL_TRABAJADOR;
    await page.goto("/feed");
    await expect(page.getByRole("heading", { name: /^Hola/ })).toBeVisible();
    await expect(page.getByTestId("perfil-faltante")).toHaveCount(0);
  });

  test("panel del comercio sin perfil: cartel en vez del error genérico", async ({ page }) => {
    await injectSession(page);
    await base(page, "employer");
    await page.route("**/api/v1/shifts/me", (r) => r.fulfill(PANEL_SIN_COMERCIO));
    await page.goto("/shifts");
    const cartel = page.getByTestId("perfil-faltante");
    await expect(cartel.getByRole("heading", { name: "Te falta completar tu comercio" })).toBeVisible();
    await expect(page.getByText(/Primero creá tu perfil/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reintentar" })).toHaveCount(0);
    await cartel.getByRole("link", { name: "Completar mi comercio" }).click();
    await expect(page).toHaveURL(/\/bienvenida\?next=%2Fshifts$/);
  });
});

test.describe("la bienvenida del comercio con el perfil ya creado", () => {
  const EXISTENTE = {
    id: "c1",
    user_id: "user-employer",
    name: "Bar Existente",
    logo_url: "https://cdn.example/logo.png",
    category: "bar",
    description: "Descripción guardada",
    address: "Calle 1",
    city: "Palermo",
    latitude: -34.58,
    longitude: -58.43,
    capacity: 40,
    opening_hours: "10 a 22",
    rating: 0,
    events_published: 0,
    on_time_payment_rate: 0,
    late_cancellations: 0,
  };

  async function preparar(page: Page) {
    await injectSession(page);
    await base(page, "employer");
    const escrituras: { metodo: string; cuerpo: Record<string, unknown> | null }[] = [];
    await page.route("**/api/v1/companies/me/profile", (r) => {
      const req = r.request();
      if (req.method() === "POST") {
        escrituras.push({ metodo: "POST", cuerpo: null });
        return r.fulfill(json(409, { detail: "El perfil de comercio ya existe" }));
      }
      if (req.method() === "PUT") {
        escrituras.push({ metodo: "PUT", cuerpo: req.postDataJSON() });
        return r.fulfill(json(200, { ...EXISTENTE, ...req.postDataJSON() }));
      }
      return r.fulfill(json(200, EXISTENTE));
    });
    return escrituras;
  }

  test("«Omitir por ahora» no pisa el perfil", async ({ page }) => {
    const escrituras = await preparar(page);
    await page.goto("/bienvenida");
    await page.getByRole("button", { name: "Omitir por ahora" }).click();
    await page.waitForURL("**/shifts");
    expect(escrituras.map((e) => e.metodo)).toEqual(["POST"]);
  });

  test("al terminar con un nombre nuevo conserva lo demás del perfil", async ({ page }) => {
    const escrituras = await preparar(page);
    await page.goto("/bienvenida");
    await page.getByLabel("Nombre del comercio").fill("Bar Renombrado");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: "Cargar la ubicación después" }).click();
    await page.waitForURL("**/shifts");
    const put = escrituras.find((e) => e.metodo === "PUT");
    expect(put?.cuerpo).toMatchObject({
      name: "Bar Renombrado",
      logo_url: "https://cdn.example/logo.png",
      description: "Descripción guardada",
      category: "bar",
      capacity: 40,
      opening_hours: "10 a 22",
      address: "Calle 1",
      latitude: -34.58,
    });
  });
});
