import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * Verificación del comercio (ADR-0013).
 *
 * El sello "Comercio verificado" existía en la UI desde el ADR-0011 pero
 * `company_verified` no podía dar `true` nunca: nada creaba el claim. Lo que
 * estos tests protegen es que el comercio tenga por dónde mandar la
 * constancia, y que cada estado del claim le diga la verdad — un comercio que
 * ya mandó su constancia y ve otra vez el botón de subir la manda dos veces;
 * uno que fue rechazado y no se entera, nunca corrige.
 */

const EMPLOYER_SESSION = {
  id: "user-1",
  email: "demo.comercio@staffya.com",
  full_name: "Comercio Demo",
  role: "employer",
  status: "activo",
  is_active: true,
  is_verified: true,
};

function identity(claims: unknown[]) {
  return {
    user_id: "user-1",
    assurance_level: "L0",
    identidad_verificada: false,
    claims,
  };
}

function businessClaim(status: string, rejectionReason: string | null = null) {
  return {
    claim_type: "negocio_verificado",
    status,
    confidence: null,
    decided_at: null,
    rejection_reason: rejectionReason,
  };
}

async function setup(page: Page, claims: unknown[]) {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(EMPLOYER_SESSION),
    })
  );
  await page.route("**/api/v1/identity/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(identity(claims)),
    })
  );
  await page.route("**/api/v1/companies/me/profile", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "c-1", user_id: "user-1", name: "Bar Demo" }),
    })
  );
}

test("el comercio sin verificar tiene por dónde mandar su constancia", async ({
  page,
}) => {
  await setup(page, []);

  await page.goto("/profile");

  await expect(
    page.getByText(/Subí la constancia de inscripción de AFIP/)
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /Subir constancia/ })).toBeVisible();
  // El aviso de retención no es decorativo: es lo que hace aceptable pedir un
  // documento fiscal (Ley 25.326, ADR-0013 §3).
  await expect(page.getByText(/la eliminamos una vez revisada/)).toBeVisible();
});

test("mientras está en revisión no se le vuelve a pedir la constancia", async ({
  page,
}) => {
  await setup(page, [businessClaim("pendiente")]);

  await page.goto("/profile");

  await expect(page.getByText(/Estamos revisando tu constancia/)).toBeVisible({
    timeout: 15_000,
  });
  // Si el formulario siguiera visible, el comercio la mandaría dos veces.
  await expect(page.getByRole("button", { name: /Subir constancia/ })).toHaveCount(0);
});

test("un rechazo dice el motivo y deja reenviar", async ({ page }) => {
  await setup(page, [businessClaim("rechazada", "La constancia está vencida")]);

  await page.goto("/profile");

  await expect(page.getByText(/La constancia está vencida/)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("button", { name: /Reenviar a revisión/ })).toBeVisible();
});

test("verificado muestra el sello y ya no pide nada", async ({ page }) => {
  await setup(page, [businessClaim("verificada")]);

  await page.goto("/profile");

  await expect(
    page.getByText("Comercio verificado", { exact: true })
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /Subir constancia/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Enviar a revisión/ })).toHaveCount(0);
});
