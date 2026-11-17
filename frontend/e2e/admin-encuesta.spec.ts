import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/** «Crecimiento» → Encuesta (ADR-0025): resumen y locales con contacto. API mockeada. */

const ADMIN = {
  id: "admin-1",
  email: "julietaarrazate@gmail.com",
  full_name: "Julieta Admin",
  role: "admin",
  status: "active",
  is_active: true,
  is_verified: true,
};

const RESUMEN = {
  total: 42,
  with_contact: 9,
  team_model: { equipo_fijo: 10, por_turno: 12, mixto: 20 },
  eventuals_normal_month: { "0": 4, "1-3": 18, "4-10": 15, mas_de_10: 5 },
  roles: { mozo: 30, runner: 8, bacha: 12, barra: 15, barista: 4, cocina: 11, caja: 2, recepcion: 1, otro: 3 },
  pricing_preference: { mensualidad: 14, por_turno: 22, no_se: 6 },
  pay_per_shift_median_ars: 42000,
  pay_per_shift_samples: 31,
};

const ITEMS = [
  {
    id: "s-1",
    created_at: "2026-11-20T15:00:00Z",
    local_kind: "bar",
    barrio: "Palermo",
    team_model: "mixto",
    eventuals_normal_month: "4-10",
    eventuals_peak_month: "mas_de_10",
    roles: ["mozo", "barra"],
    current_channels: ["whatsapp"],
    pay_per_shift_ars: 45000,
    last_absence_outcome: ["doble_turno"],
    pricing_preference: "por_turno",
    wants_beta: true,
    contact_name: "Ana Pérez",
    business_name: "Lo de Ana",
    phone: "+54 11 5555-0000",
    email: "ana@lodeana.com",
    consent_at: "2026-11-20T15:00:00Z",
    source: "grupo-palermo",
  },
];

async function mockAdmin(page: Page, vacia = false) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ADMIN) })
  );
  await page.route("**/api/v1/admin/leads/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) })
  );
  await page.route(/\/api\/v1\/admin\/leads(\?.*)?$/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/v1/admin/encuesta/summary", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(vacia ? { ...RESUMEN, total: 0, with_contact: 0, pay_per_shift_median_ars: null, pay_per_shift_samples: 0 } : RESUMEN),
    })
  );
  await page.route(/\/api\/v1\/admin\/encuesta\?.*/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(vacia ? { items: [], total: 0 } : { items: ITEMS, total: 1 }),
    })
  );
}

test("muestra el resumen y los locales que dejaron contacto", async ({ page }) => {
  await mockAdmin(page);
  await page.goto("/admin/leads");
  await page.getByRole("button", { name: "Encuesta" }).click();

  await expect(page.getByRole("heading", { name: "Encuesta para locales" })).toBeVisible();
  const resumen = page.getByRole("region", { name: "Resumen de la encuesta" });
  await expect(resumen.getByText("42", { exact: true })).toBeVisible();
  await expect(resumen.getByText("Con contacto para la beta")).toBeVisible();
  await expect(resumen.getByText("$ 42.000").or(resumen.getByText("$42.000"))).toBeVisible();
  await expect(resumen.getByText("Un poco de cada uno")).toBeVisible();

  const lista = page.getByRole("region", { name: "Locales con contacto" });
  await expect(lista.getByText("Lo de Ana")).toBeVisible();
  await expect(lista.getByRole("link", { name: "ana@lodeana.com" })).toHaveAttribute("href", "mailto:ana@lodeana.com");
  await expect(lista.getByText("Quiere la beta")).toBeVisible();
  await expect(lista.getByText("ref: grupo-palermo")).toBeVisible();
});

test("sin respuestas no inventa números", async ({ page }) => {
  await mockAdmin(page, true);
  await page.goto("/admin/leads");
  await page.getByRole("button", { name: "Encuesta" }).click();
  await expect(page.getByText("Sin datos")).toBeVisible();
  await expect(page.getByText("Todavía nadie dejó su contacto")).toBeVisible();
});
