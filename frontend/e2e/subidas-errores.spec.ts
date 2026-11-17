import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * Subidas de archivos (beta etapa 3, U051/U052/U091): cada causa de error
 * tiene su mensaje, el CV subido se puede reemplazar y «años de experiencia»
 * se puede vaciar sin quedar en «07».
 */
const WORKER_SESSION = {
  id: "user-1",
  email: "worker@staffya.com",
  full_name: "Trabajador Nuevo",
  role: "worker",
  status: "activo",
  is_active: true,
  is_verified: false,
};

const PROFILE = {
  id: "profile-1",
  user_id: "user-1",
  full_name: "Trabajador Nuevo",
  photo_url: null,
  city: "Palermo, CABA",
  bio: null,
  latitude: -34.5875,
  longitude: -58.4257,
  skills: ["mozo"],
  years_experience: 3,
  languages: [],
  certifications: [],
  cv_url: "https://res.cloudinary.com/demo/raw/upload/cv.pdf",
  cv_filename: "mi-cv.pdf",
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

async function setup(page: Page) {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  const json = (body: unknown) => ({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json(WORKER_SESSION)));
  await page.route("**/api/v1/workers/me/profile", (r) => r.fulfill(json(PROFILE)));
  await page.route("**/api/v1/identity/me", (r) => r.fulfill(json({ claims: [] })));
}

test("CV subido: ofrece Reemplazar y un tipo no permitido dice por qué", async ({ page }) => {
  await setup(page);
  await page.goto("/profile/edit");
  await expect(page.getByRole("button", { name: "Reemplazar" })).toBeVisible({ timeout: 15_000 });

  await page
    .locator('input[type="file"]:not([accept="image/*"])')
    .setInputFiles({ name: "virus.exe", mimeType: "application/octet-stream", buffer: Buffer.from("x") });
  await expect(page.getByText(/tipo de archivo no está permitido/)).toBeVisible();
});

test("un PDF como foto de perfil no abre el encuadre", async ({ page }) => {
  await setup(page);
  await page.route("**/api/v1/workers/me/earnings", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ total_earned: "0", this_month_earned: "0", shifts_completed: 0 }),
    })
  );
  await page.route("**/api/v1/reviews/received", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.goto("/profile");
  await page
    .locator('input[type="file"][accept="image/*"]')
    .first()
    .setInputFiles({ name: "a.pdf", mimeType: "application/pdf", buffer: Buffer.from("x") });
  await expect(page.getByText(/tipo de archivo no está permitido/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Encuadrá tu foto")).toHaveCount(0);
});

test("años de experiencia se puede vaciar y no deja ceros a la izquierda", async ({ page }) => {
  await setup(page);
  await page.goto("/profile/edit");
  const campo = page.locator('input[type="number"]').first();
  await expect(campo).toHaveValue("3", { timeout: 15_000 });
  await campo.fill("");
  await expect(campo).toHaveValue("");
  await campo.fill("");
  await campo.pressSequentially("07");
  await expect(campo).toHaveValue("7");
});
