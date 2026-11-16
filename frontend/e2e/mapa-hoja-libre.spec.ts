import { test, expect } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * U105 (G21): en el celular la hoja de tarjetas de /map tapaba los pines; al
 * abrir sólo asomaba la punta de uno. La cámara centraba el turno en el medio
 * del mapa, y el medio queda justo debajo del borde de la hoja (que cubre ~44%
 * del alto). Ahora el padding inferior de la cámara es el alto visible de la
 * hoja, así que el pin del turno activo cae arriba de ella.
 */

const WORKER_SESSION = {
  id: "user-1",
  email: "mozo@staffya.test",
  full_name: "Mozo Demo",
  role: "worker",
  status: "activo",
  is_active: true,
  is_verified: true,
};

const SHIFT = {
  id: "shift-1",
  company_id: "company-1",
  position: "mozo",
  quantity: 1,
  start_at: "2026-12-11T20:00:00-03:00",
  end_at: "2026-12-12T02:00:00-03:00",
  pay_amount: "45000",
  currency: "ARS",
  tips: false,
  meal: false,
  dress_code: null,
  urgent: false,
  address: "Gorriti 5000",
  city: "Palermo, CABA",
  latitude: -34.5875,
  longitude: -58.4257,
  title: null,
  description: null,
  status: "publicado",
  worker_profile_id: null,
  worker_name: null,
  en_route_latitude: null,
  en_route_longitude: null,
  en_route_at: null,
  check_in_latitude: null,
  check_in_longitude: null,
  check_in_at: null,
  check_out_latitude: null,
  check_out_longitude: null,
  check_out_at: null,
  paid_at: null,
  no_show_at: null,
  last_no_show_worker_profile_id: null,
  created_at: "2026-12-01T12:00:00-03:00",
  company_name: "Bar Demo",
  company_logo_url: null,
  company_verified: false,
  pay_band: "tipico",
};

test("en el celular el pin del turno activo queda arriba de la hoja de tarjetas", async ({
  page,
}) => {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await page.route("**/api/v1/**", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
      : route.continue()
  );
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/shifts/feed", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([SHIFT]) })
  );
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(WORKER_SESSION) })
  );

  await page.goto("/map");

  // El pin del turno (no el punto azul de la persona, que también es un marker).
  const pin = page.getByRole("button", { name: /^Turno de mozo/ });
  await expect(pin).toBeVisible({ timeout: 20_000 });
  const canvas = page.locator(".maplibregl-canvas").first();
  const handle = page.getByRole("button", { name: /Arrastrá o tocá para cambiar el tamaño/ });
  await expect(handle).toBeVisible();

  // La cámara tarda en asentarse (padding + paneo a la tarjeta activa).
  await expect
    .poll(
      async () => {
        const pinBox = await pin.boundingBox();
        const sheetTop = (await handle.boundingBox())?.y;
        const mapTop = (await canvas.boundingBox())?.y;
        if (!pinBox || sheetTop == null || mapTop == null) return false;
        // El pin entero (no sólo la punta) arriba de la hoja, y el turno activo
        // en el medio de la franja libre (no pegado al borde de la hoja).
        const centroPin = pinBox.y + pinBox.height / 2;
        const centroLibre = (mapTop + sheetTop) / 2;
        return pinBox.y + pinBox.height <= sheetTop && Math.abs(centroPin - centroLibre) <= 40;
      },
      { timeout: 10_000 }
    )
    .toBe(true);
});
