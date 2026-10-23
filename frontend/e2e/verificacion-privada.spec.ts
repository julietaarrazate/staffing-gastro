import { test, expect, type Page } from "@playwright/test";
import {
  blockExternalHosts,
  injectSession,
  mockEmptyNotifications,
  setTheme,
  skipSplash,
} from "./mocks";

/**
 * Documentos de identidad privados (ADR-0021). La cola del admin ya no trae
 * URLs: cada evidencia pide su propio link a `/identity/evidences/{id}/link`,
 * que vence a los 5 minutos. Lo que estos tests protegen es que la pantalla
 * use ese link (y no una URL guardada) y que el trabajador lea que sus fotos
 * quedan privadas.
 */

const SHOTS = process.env.SHOTS_DIR ?? "test-results";

const json = (body: unknown) => ({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify(body),
});

const ADMIN_SESSION = {
  id: "admin-1",
  email: "admin@oido.com.ar",
  full_name: "Julieta Arrazate",
  role: "admin",
  status: "active",
  is_active: true,
  is_verified: true,
};

const WORKER_SESSION = {
  id: "user-1",
  email: "nuevo@staffya.com",
  full_name: "Trabajador Nuevo",
  role: "worker",
  status: "activo",
  is_active: true,
  is_verified: false,
};

const PENDING = [
  {
    claim_id: "c-1",
    user_id: "u-1",
    claim_type: "documento_verificado",
    full_name: "Ana Prueba",
    company_name: null,
    submitted_at: "2026-10-23T12:00:00Z",
    evidences: [
      { evidence_id: "ev-dni", evidence_type: "dni_frente", available: true },
      { evidence_id: "ev-selfie", evidence_type: "selfie", available: true },
    ],
  },
  {
    claim_id: "c-2",
    user_id: "u-2",
    claim_type: "negocio_verificado",
    full_name: "Beto Dueño",
    company_name: "Bar La Esquina",
    submitted_at: "2026-10-23T12:05:00Z",
    evidences: [
      { evidence_id: "ev-afip", evidence_type: "constancia_cuit", available: true },
    ],
  },
];

const signedUrl = (id: string) =>
  `https://api.cloudinary.com/v1_1/oido-test/image/download?public_id=${id}&expires_at=9999999999&signature=x`;

// Imagen de mentira para las evidencias (en vez de pedirle a Cloudinary).
const fakeImage = (label: string, fill: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="${fill}"/><text x="150" y="108" font-family="sans-serif" font-size="22" text-anchor="middle" fill="#1f2a3a">${label}</text></svg>`;

async function mockAdmin(page: Page, linkCalls: string[]) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) => route.fulfill(json(ADMIN_SESSION)));
  await page.route("**/api/v1/identity/claims/pending", (route) =>
    route.fulfill(json(PENDING))
  );
  await page.route("**/api/v1/identity/evidences/*/link", (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-2) ?? "";
    linkCalls.push(id);
    return route.fulfill(
      json({ url: signedUrl(id), expires_at: new Date(Date.now() + 300_000).toISOString() })
    );
  });
  await page.route("https://api.cloudinary.com/**", (route) => {
    const id = new URL(route.request().url()).searchParams.get("public_id");
    return route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: id === "ev-selfie" ? fakeImage("Selfie de prueba", "#dbe7f3") : fakeImage("DNI de prueba", "#e8eef5"),
    });
  });
}

async function mockWorker(page: Page) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) => route.fulfill(json(WORKER_SESSION)));
  await page.route("**/api/v1/workers/me/profile", (route) =>
    route.fulfill(
      json({
        id: "profile-1",
        user_id: "user-1",
        full_name: "Trabajador Nuevo",
        photo_url: null,
        city: "Palermo, CABA",
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
      })
    )
  );
  await page.route("**/api/v1/workers/me/earnings", (route) =>
    route.fulfill(json({ total_earned: "0", this_month_earned: "0", shifts_completed: 0 }))
  );
  await page.route("**/api/v1/reviews/received", (route) => route.fulfill(json([])));
  await page.route("**/api/v1/identity/me", (route) =>
    route.fulfill(
      json({ user_id: "user-1", assurance_level: "L0", identidad_verificada: false, claims: [] })
    )
  );
}

test("la cola del admin muestra cada evidencia con su link que vence", async ({ page }) => {
  const linkCalls: string[] = [];
  await mockAdmin(page, linkCalls);
  await page.goto("/admin/verificacion");

  const dni = page.getByRole("img", { name: "DNI (frente)" });
  await expect(dni).toBeVisible({ timeout: 15_000 });
  await expect(dni).toHaveAttribute("src", signedUrl("ev-dni"));
  // La constancia (PDF) se abre como documento, con su propio link.
  await expect(page.getByRole("link", { name: /Abrir documento/ })).toHaveAttribute(
    "href",
    signedUrl("ev-afip")
  );
  expect(new Set(linkCalls)).toEqual(new Set(["ev-dni", "ev-selfie", "ev-afip"]));
});

test("el trabajador lee que sus fotos quedan privadas", async ({ page }) => {
  await mockWorker(page);
  await page.goto("/profile");
  await expect(page.getByText(/Quedan\s+privadas/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Subir DNI (frente)" })).toBeVisible();
});

for (const theme of ["light", "dark"] as const) {
  for (const viewport of [
    { name: "390", width: 390, height: 844 },
    { name: "1280", width: 1280, height: 900 },
  ]) {
    test(`captura de la cola de verificación en ${theme}, ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setTheme(page, theme);
      await mockAdmin(page, []);
      await page.goto("/admin/verificacion");
      await expect(page.getByRole("img", { name: "Selfie" })).toBeVisible({ timeout: 15_000 });
      await page.screenshot({
        path: `${SHOTS}/admin-verificacion-${theme}-${viewport.name}.png`,
        fullPage: true,
      });
    });

    test(`captura de la subida del trabajador en ${theme}, ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setTheme(page, theme);
      await mockWorker(page);
      await page.goto("/profile");
      const copy = page.getByText(/Quedan\s+privadas/);
      await expect(copy).toBeVisible({ timeout: 15_000 });
      // Sin `fullPage`: la barra de abajo es fija y en una captura de página
      // entera queda pintada encima de la tarjeta. Centrada en pantalla.
      await copy.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await page.screenshot({ path: `${SHOTS}/perfil-subida-dni-${theme}-${viewport.name}.png` });
    });
  }
}
