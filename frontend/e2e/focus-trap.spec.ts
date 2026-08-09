import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * F1 (auditoría de producto/UI 2026-08-09): `Modal`/`Sheet` ya tenían
 * `role="dialog"`/`aria-modal="true"` y cierre con Escape, pero ninguno
 * atrapaba `Tab`/`Shift+Tab` dentro del diálogo ni movía/restauraba el foco
 * — un usuario de teclado podía tabular hacia contenido de fondo tapado
 * visualmente por el backdrop. Este spec ejercita el `Sheet` "Más acciones"
 * de `/shifts` (el mismo que `sheet-touch.spec.ts` usa para el bug de la X).
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

async function activeElementInsideDialog(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    return dialog != null && dialog.contains(document.activeElement);
  });
}

test("el focus trap del Sheet 'Más acciones' no deja tabular hacia el fondo, y restaura el foco al cerrar", async ({
  page,
}) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await mockEmployerShifts(page);

  await page.goto("/shifts");
  const trigger = page.getByRole("button", { name: "Más acciones" });
  await trigger.click();

  const sheet = page.getByRole("dialog", { name: "Más acciones" });
  await expect(sheet).toBeVisible();

  // Al abrir, el foco se mueve adentro del diálogo (no se queda en el botón
  // que lo abrió, ni en ningún otro lado de la página).
  expect(await activeElementInsideDialog(page)).toBe(true);

  // Más Tabs que elementos focuseables adentro del sheet: si el trap
  // funciona, el foco nunca se escapa del diálogo en ninguna vuelta.
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    expect(await activeElementInsideDialog(page)).toBe(true);
  }

  // Shift+Tab también se queda adentro (recorrido inverso).
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Shift+Tab");
    expect(await activeElementInsideDialog(page)).toBe(true);
  }

  await page.keyboard.press("Escape");
  await expect(sheet).not.toBeVisible();

  // El foco vuelve a donde estaba antes de abrir el diálogo (el botón que lo
  // disparó) — sin esto, tras cerrar con teclado el foco queda huérfano.
  await expect(trigger).toBeFocused();
});
