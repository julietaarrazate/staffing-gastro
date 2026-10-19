import { test, expect } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * El mapa del trabajador abre donde está la persona y ordena los turnos por
 * cercanía a ella (auditoría de interfaz 2026-10-11, B02). Antes la lista
 * llegaba en el orden del backend (zona del perfil) y la cámara saltaba a la
 * primera tarjeta, así que siempre se veía la zona de ese turno: el reporte
 * de Julieta fue "me muestra la zona donde trabajo, no donde estoy".
 */

const WORKER_SESSION = {
  id: "user-1",
  email: "demo.mozo.palermo@staffya.com",
  full_name: "Mozo Demo",
  role: "worker",
  status: "activo",
  is_active: true,
  is_verified: true,
};

function shift(id: string, companyName: string, latitude: number, longitude: number) {
  return {
    id,
    company_id: `company-${id}`,
    position: "mozo",
    quantity: 1,
    start_at: "2026-10-20T20:00:00-03:00",
    end_at: "2026-10-20T23:00:00-03:00",
    pay_amount: "45000",
    currency: "ARS",
    tips: true,
    dress_code: null,
    urgent: false,
    address: null,
    city: "CABA",
    latitude,
    longitude,
    title: null,
    description: null,
    status: "buscando_personal",
    worker_profile_id: null,
    created_at: "2026-10-11T12:00:00-03:00",
    company_name: companyName,
    company_logo_url: null,
  };
}

// La persona está en San Telmo. El backend manda primero un turno en
// Belgrano (su zona de perfil) y después uno a pocas cuadras de ella.
const LEJOS = shift("lejos", "Bar Belgrano", -34.5627, -58.4562);
const CERCA = shift("cerca", "Bar San Telmo", -34.6212, -58.3731);

test.use({ geolocation: { latitude: -34.6205, longitude: -58.3725 }, permissions: ["geolocation"] });

test("el mapa ordena los turnos por cercanía a la ubicación real", async ({ page }) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(WORKER_SESSION) })
  );
  await page.route("**/api/v1/shifts/feed", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([LEJOS, CERCA]) })
  );
  await page.route("**/api/v1/applications/mine", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  await page.goto("/map");

  // La primera tarjeta de la lista es la cercana, aunque el backend la haya
  // mandado segunda.
  const cards = page.getByRole("button", { name: /^Mozo\/a Bar / });
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toContainText("Bar San Telmo");
  await expect(cards.nth(1)).toContainText("Bar Belgrano");
});
