import { test, expect, type Page } from "@playwright/test";
import { deContrato } from "./contrato";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * VIE-01: el comercio tiene la lista de candidatos abierta, la persona retira
 * su postulación y el comercio le toca «Asignar» sobre la tarjeta vieja. Si el
 * servidor falla (o no), la pantalla vuelve a pedir la lista y la tarjeta
 * vieja desaparece, en vez de quedarse con lo de antes.
 */

const EMPLOYER = deContrato("auth_me_employer");
const [LUCIA] = deContrato("postulantes", [
  { application_id: "application-1", worker_profile_id: "worker-profile-1", full_name: "Lucía Postulada", rating: 4.8, events_completed: 12, punctuality_rate: 0.95, years_experience: 3 },
]);

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

async function setup(page: Page, lista: () => unknown[]) {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json(EMPLOYER)));
  await page.route("**/api/v1/shifts/shift-1", (r) =>
    r.fulfill(json(deContrato("turno_publicado_comercio")))
  );
  await page.route("**/api/v1/applications/shifts/shift-1", (r) => r.fulfill(json(lista())));
  await page.route("**/api/v1/shifts/shift-1/candidates", (r) => r.fulfill(json([])));
}

test("si asignar falla, la lista se vuelve a pedir y la tarjeta que ya no está desaparece", async ({ page }) => {
  let postulantes: unknown[] = [LUCIA];
  await setup(page, () => postulantes);
  await page.route("**/api/v1/shifts/shift-1/assign", (r) => {
    // Mientras tanto, la persona retiró su postulación.
    postulantes = [];
    return r.fulfill(json({ detail: "No se pudo asignar" }, 400));
  });

  await page.goto("/shifts/shift-1/candidates");
  await expect(page.getByText("Lucía Postulada")).toBeVisible();

  await page.getByRole("button", { name: "Asignar" }).click();
  await expect(page.getByText("Lucía Postulada")).toHaveCount(0);
  await expect(page.getByText("Todavía nadie se postuló")).toBeVisible();
});
