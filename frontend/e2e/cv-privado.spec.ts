import { test, expect, type Page } from "@playwright/test";
import {
  blockExternalHosts,
  injectSession,
  mockEmptyNotifications,
  setTheme,
  skipSplash,
} from "./mocks";

/**
 * El CV es privado (PRI-03; ADR-0021, «Actualización 2026-11-19: el CV
 * también»). El perfil ya no trae una URL que sirva sola: quien hoy puede ver
 * el CV pide un link que vence (`/workers/{id}/cv-link`) en el momento de
 * tocar «Ver CV». Lo que estos tests protegen es que la pantalla pida ese
 * link (y no use una URL guardada), que el trabajador siga viendo y cambiando
 * su CV, y que mande de vuelta la referencia del archivo al guardar.
 */

const SHOTS = process.env.SHOTS_DIR ?? "test-results";

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

const EMPLOYER = {
  id: "user-1",
  email: "demo.comercio@staffya.com",
  full_name: "Comercio Demo",
  role: "employer",
  status: "activo",
  is_active: true,
  is_verified: true,
};

const WORKER = { ...EMPLOYER, id: "user-2", email: "demo@staffya.com", full_name: "Vera Mozo", role: "worker" };

const CV_FILE = {
  public_id: `oido/cv/${"e".repeat(64)}`,
  resource_type: "image",
  format: "pdf",
  type: "authenticated",
};

const LINK = "https://cv.oido.test/abrir?vence=300";

const perfil = (over: Record<string, unknown>) => ({
  id: "wp-cv",
  user_id: "user-2",
  full_name: "Vera Mozo",
  photo_url: null,
  birth_date: null,
  age: null,
  city: "Palermo",
  bio: null,
  latitude: null,
  longitude: null,
  skills: ["mozo"],
  years_experience: 2,
  languages: [],
  certifications: [],
  cv_url: null,
  cv_file: null,
  cv_filename: null,
  cv_kind: null,
  is_available: true,
  rating: 0,
  events_completed: 0,
  punctuality_rate: 0,
  cancellations: 0,
  no_shows: 0,
  badges: [],
  level: "bronce",
  identidad_verificada: false,
  ...over,
});

async function base(page: Page, session: typeof EMPLOYER) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json(session)));
  await page.route("**/api/v1/favorites/*/status", (r) => r.fulfill(json({ is_favorite: false })));
  await page.route("**/api/v1/reviews/**", (r) => r.fulfill(json([])));
  // El link que vence: una página cualquiera (en producción, la API de
  // descarga de Cloudinary). En el contexto: se abre en otra pestaña.
  await page.context().route("https://cv.oido.test/**", (r) =>
    r.fulfill({ status: 200, contentType: "text/html", body: "<h1>CV de prueba</h1>" })
  );
}

/** Perfil público que ve el comercio, con su `cv-link`. Anota los pedidos. */
async function comercio(page: Page, over: Record<string, unknown>, linkStatus = 200) {
  const pedidos: string[] = [];
  await base(page, EMPLOYER);
  await page.route("**/api/v1/workers/wp-cv", (r) => r.fulfill(json(perfil(over))));
  await page.route("**/api/v1/workers/wp-cv/cv-link*", (r) => {
    pedidos.push(new URL(r.request().url()).search);
    return linkStatus === 200
      ? r.fulfill(json({ url: LINK, expires_at: new Date(Date.now() + 300_000).toISOString() }))
      : r.fulfill(json({ detail: "CV no encontrado" }, linkStatus));
  });
  return pedidos;
}

test("el comercio abre el CV con un link que pide en el momento", async ({ page }) => {
  const pedidos = await comercio(page, { cv_kind: "file", cv_filename: "CV-Vera.pdf" });
  await page.goto("/workers/wp-cv");
  const ver = page.getByRole("button", { name: "Ver CV" });
  await expect(ver).toBeVisible({ timeout: 15_000 });
  // Nada en la pantalla apunta al archivo: no hay links a Cloudinary.
  await expect(page.locator('a[href*="cloudinary"]')).toHaveCount(0);
  expect(pedidos).toEqual([]);

  const [pestana] = await Promise.all([page.waitForEvent("popup"), ver.click()]);
  await expect(pestana).toHaveURL(LINK);
  expect(pedidos).toEqual([""]);
});

test("«Descargar» pide el CV como adjunto", async ({ page }) => {
  const pedidos = await comercio(page, { cv_kind: "file" });
  await page.goto("/workers/wp-cv");
  await page.getByRole("button", { name: "Descargar" }).click({ timeout: 15_000 });
  await expect.poll(() => pedidos).toEqual(["?download=true"]);
});

test("un link pegado a mano se ve pero no se descarga, y sin CV no hay botón", async ({ page }) => {
  await comercio(page, { cv_kind: "link" });
  await page.goto("/workers/wp-cv");
  await expect(page.getByRole("button", { name: "Ver CV" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Descargar" })).toHaveCount(0);

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await comercio(page, { cv_kind: null });
  await page.goto("/workers/wp-cv");
  await expect(page.getByRole("heading", { name: /Vera Mozo/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Ver CV" })).toHaveCount(0);
});

test("si el link no llega (el vínculo terminó, el CV ya no está), lo dice en castellano", async ({ page }) => {
  await comercio(page, { cv_kind: "file" }, 404);
  await page.goto("/workers/wp-cv");
  await page.getByRole("button", { name: "Ver CV" }).click({ timeout: 15_000 });
  await expect(page.getByText("No pudimos abrir el CV. Probá de nuevo en un rato.")).toBeVisible();
});

/** Formulario del perfil del trabajador con su CV privado guardado. */
async function trabajador(page: Page, puts: Record<string, unknown>[]) {
  await base(page, WORKER);
  const guardado = perfil({ cv_file: CV_FILE, cv_filename: "CV-Vera.pdf", cv_kind: "file" });
  await page.route("**/api/v1/workers/me/profile", (r) => {
    if (r.request().method() === "PUT") {
      const body = r.request().postDataJSON() as Record<string, unknown>;
      puts.push(body);
      return r.fulfill(json({ ...guardado, ...body }));
    }
    return r.fulfill(json(guardado));
  });
  await page.route("**/api/v1/workers/wp-cv/cv-link*", (r) =>
    r.fulfill(json({ url: LINK, expires_at: new Date(Date.now() + 300_000).toISOString() }))
  );
  await page.route("**/api/v1/identity/me", (r) => r.fulfill(json({ claims: [] })));
}

test("el trabajador ve su CV, lo abre con un link que vence y al guardar manda la referencia", async ({ page }) => {
  const puts: Record<string, unknown>[] = [];
  await trabajador(page, puts);
  await page.goto("/profile/edit");
  const nombre = page.getByRole("button", { name: "CV-Vera.pdf" });
  await expect(nombre).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Reemplazar" })).toBeVisible();

  const [pestana] = await Promise.all([page.waitForEvent("popup"), nombre.click()]);
  await expect(pestana).toHaveURL(LINK);

  await page.getByRole("button", { name: /Guardar/ }).click();
  await expect.poll(() => puts.length).toBe(1);
  expect(puts[0]).toMatchObject({ cv_file: CV_FILE, cv_url: null, cv_filename: "CV-Vera.pdf" });

  await page.getByRole("button", { name: "Quitar CV" }).click();
  await page.getByRole("button", { name: /Guardar/ }).click();
  await expect.poll(() => puts.length).toBe(2);
  expect(puts[1]).toMatchObject({ cv_file: null, cv_url: null, cv_filename: null });
});

test("un formulario abierto desde antes no repone un CV que la persona ya cambió en otro lado", async ({ page }) => {
  // Revisión del 2026-11-19: el formulario se abrió con el CV A; después, en
  // otro dispositivo, la persona lo cambió por B (A se borra). Guardar otra
  // cosa desde el formulario viejo no tiene que volver a poner A.
  const puts: Record<string, unknown>[] = [];
  const nuevo = { ...CV_FILE, public_id: `oido/cv/${"f".repeat(64)}` };
  let lecturas = 0;
  await base(page, WORKER);
  await page.route("**/api/v1/workers/me/profile", (r) => {
    if (r.request().method() === "PUT") {
      const body = r.request().postDataJSON() as Record<string, unknown>;
      puts.push(body);
      return r.fulfill(json(perfil({ ...body, cv_kind: "file" })));
    }
    lecturas += 1;
    const cv = lecturas === 1 ? CV_FILE : nuevo;
    return r.fulfill(json(perfil({ cv_file: cv, cv_filename: "CV-Vera.pdf", cv_kind: "file", bio: null })));
  });
  await page.route("**/api/v1/identity/me", (r) => r.fulfill(json({ claims: [] })));
  await page.goto("/profile/edit");
  await expect(page.getByRole("button", { name: "CV-Vera.pdf" })).toBeVisible({ timeout: 15_000 });

  await page.getByPlaceholder(/Mozo con 5 años/).fill("Mozo con experiencia en eventos");
  await page.getByRole("button", { name: /Guardar/ }).click();
  await expect.poll(() => puts.length).toBe(1);
  expect(puts[0]).toMatchObject({ bio: "Mozo con experiencia en eventos", cv_file: nuevo });
});

for (const theme of ["light", "dark"] as const) {
  test(`captura del CV en el perfil público, ${theme}`, async ({ page }) => {
    await setTheme(page, theme);
    await comercio(page, { cv_kind: "file", cv_filename: "CV-Vera.pdf" }, 404);
    await page.goto("/workers/wp-cv");
    const ver = page.getByRole("button", { name: "Ver CV" });
    await expect(ver).toBeVisible({ timeout: 15_000 });
    await ver.click();
    await expect(page.getByText(/No pudimos abrir el CV/)).toBeVisible();
    await ver.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page.screenshot({ path: `${SHOTS}/cv-perfil-publico-${theme}.png` });
  });

  test(`captura del CV en el formulario del trabajador, ${theme}`, async ({ page }) => {
    await setTheme(page, theme);
    await trabajador(page, []);
    await page.goto("/profile/edit");
    const nombre = page.getByRole("button", { name: "CV-Vera.pdf" });
    await expect(nombre).toBeVisible({ timeout: 15_000 });
    await nombre.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page.screenshot({ path: `${SHOTS}/cv-formulario-${theme}.png` });
  });
}
