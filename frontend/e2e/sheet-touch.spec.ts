import { test, expect, devices, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * Regresión: "la X del Sheet no cierra, sólo deslizando" (Julieta,
 * 2026-08-07 y de nuevo 2026-08-08, en su teléfono real — dos fixes
 * anteriores al drag de Framer Motion no alcanzaron).
 *
 * Causa raíz real, reproducida acá con `.tap()` (touch real, no mouse) en un
 * dispositivo emulado: `Sheet`/`Modal` no portaban a `document.body`. Un
 * `Card` ancestro con `whileTap` activo (`components/ui/Card.tsx`) le rompe
 * el *containing block* al `position: fixed` — el wrapper del sheet queda
 * confinado a la caja del `Card` en vez de cubrir el viewport, así que el
 * navegador hace el hit-test del click en un punto que ya no coincide con
 * el botón (aunque se vea bien). `createPortal` a `document.body` lo
 * arregla de raíz para cualquier ancestro, no sólo `Card`.
 */

test.use({ ...devices["Pixel 7"] });

const EMPLOYER_SESSION = {
  id: "user-1",
  email: "demo.comercio@staffya.com",
  full_name: "Comercio Demo",
  role: "employer",
  status: "activo",
  is_active: true,
  is_verified: true,
};

const SHIFT = {
  id: "shift-1",
  company_id: "company-1",
  position: "mozo",
  quantity: 1,
  start_at: "2026-08-20T20:00:00-03:00",
  end_at: "2026-08-20T23:00:00-03:00",
  pay_amount: "15000",
  currency: "ARS",
  tips: false,
  dress_code: null,
  urgent: false,
  address: null,
  city: "Palermo, CABA",
  latitude: null,
  longitude: null,
  title: null,
  description: null,
  status: "asignado",
  worker_profile_id: "wp-1",
  check_in_latitude: null,
  check_in_longitude: null,
  check_in_at: null,
  check_out_latitude: null,
  check_out_longitude: null,
  check_out_at: null,
  paid_at: null,
  created_at: "2026-08-01T12:00:00-03:00",
  company_name: null,
  company_logo_url: null,
};

async function mockEmployerShifts(page: Page) {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(EMPLOYER_SESSION) })
  );
  await page.route("**/api/v1/shifts/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([SHIFT]) })
  );
}

test("toque real en la X del Sheet 'Más acciones' lo cierra (dentro de un Card con whileTap)", async ({ page }) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockEmployerShifts(page);

  await page.goto("/shifts");
  await page.getByRole("button", { name: "Más acciones" }).tap();
  const sheet = page.getByRole("dialog", { name: "Más acciones" });
  await expect(sheet).toBeVisible();

  await sheet.getByRole("button", { name: "Cerrar" }).tap();
  await expect(sheet).not.toBeVisible();
});

test("toque real en 'Cancelar turno' (contenido del Sheet) abre la confirmación", async ({ page }) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockEmployerShifts(page);

  await page.goto("/shifts");
  await page.getByRole("button", { name: "Más acciones" }).tap();
  const sheet = page.getByRole("dialog", { name: "Más acciones" });
  await expect(sheet).toBeVisible();

  await sheet.getByRole("button", { name: "Cancelar turno" }).tap();
  await expect(page.getByRole("dialog", { name: "¿Cancelar este turno?" })).toBeVisible();
});
