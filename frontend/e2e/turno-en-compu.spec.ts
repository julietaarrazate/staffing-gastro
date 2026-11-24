import { createServer, type Server } from "node:http";
import { test, expect } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * Escritorio, renglón 12 (2026-11-24): el detalle del turno en la compu pone la
 * portada (la foto del local, o el cielo) a la izquierda y la hoja con el
 * pago, el cuándo, el dónde y «Postularme» a la derecha. En el celular, la
 * portada arriba y la hoja debajo, como siempre.
 *
 * `/turno/[id]` se arma en el servidor y su API no se puede simular con
 * `page.route`: este spec levanta su propia API simulada, pero sólo sirve si el
 * build se hizo apuntando a ella (CI no lo hace, así que ahí se saltea):
 *
 *   NEXT_PUBLIC_API_URL=http://localhost:4111/api/v1 npm run build
 *   TURNO_API_PORT=4111 npx playwright test e2e/turno-en-compu.spec.ts
 */
const PUERTO = Number(process.env.TURNO_API_PORT ?? 0);
const ID = "11111111-1111-4111-8111-111111111111";
const PUBLICO = {
  id: ID, position: "mozo", start_at: "2026-12-10T20:00:00-03:00", end_at: "2026-12-11T01:00:00-03:00", city: "Palermo",
  pay_amount: "20000.00", currency: "ARS", company_name: "Bar Lavalle", tips: true, meal: true, dress_code: null, urgent: true,
  company_cover_url: null,
};
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

test.skip(!PUERTO, "necesita un build apuntando a una API simulada (TURNO_API_PORT)");
// Un solo worker: la API simulada ocupa un puerto.
test.describe.configure({ mode: "serial" });

let api: Server;
test.beforeAll(async () => {
  api = createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.url?.includes(`/shifts/${ID}/public`)) res.end(JSON.stringify(PUBLICO));
    else { res.statusCode = 404; res.end("{}"); }
  });
  await new Promise<void>((ok) => api.listen(PUERTO, ok));
});
test.afterAll(() => api?.close());

test.beforeEach(async ({ page }) => {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json({ id: "u1", email: "w@oido.test", full_name: "Lu", role: "worker", status: "activo", is_active: true, is_verified: true })));
  await page.route(`**/api/v1/shifts/${ID}`, (r) => r.fulfill(json({ ...PUBLICO, company_id: "c1", quantity: 1, status: "publicado", address: null, latitude: null, longitude: null, title: null, description: null, worker_profile_id: null, created_at: "2026-11-01T12:00:00-03:00" })));
  await page.route("**/api/v1/applications/mine**", (r) => r.fulfill(json([])));
  await page.route("**/api/v1/saved-shifts**", (r) => r.fulfill(json([])));
});

test("en la compu la portada va a la izquierda y la hoja con la acción a la derecha", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/turno/${ID}`);
  const hoja = page.getByRole("region", { name: "El turno" });
  await expect(hoja.getByRole("heading", { level: 1, name: "Mozo/a" })).toBeVisible();
  const portada = (await page.locator("header").filter({ has: page.getByRole("button", { name: "Volver" }) }).boundingBox())!;
  const h = (await hoja.boundingBox())!;
  expect(h.x).toBeGreaterThanOrEqual(portada.x + portada.width);
  expect(Math.abs(h.y - portada.y)).toBeLessThan(2);
  expect(portada.width).toBeGreaterThan(300);
  expect(h.width).toBeGreaterThan(480);
  const accion = (await page.getByRole("button", { name: "Postularme" }).boundingBox())!;
  expect(accion.x).toBeGreaterThanOrEqual(h.x);
  expect(accion.y + accion.height).toBeLessThanOrEqual(h.y + h.height);
});

test("en el celular la portada va arriba y la hoja debajo", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/turno/${ID}`);
  const hoja = page.getByRole("region", { name: "El turno" });
  await expect(hoja).toBeVisible();
  const portada = (await page.locator("header").filter({ has: page.getByRole("button", { name: "Volver" }) }).boundingBox())!;
  const h = (await hoja.boundingBox())!;
  expect(h.y).toBeGreaterThan(portada.y + portada.height - 40);
  expect(portada.width).toBeGreaterThan(380);
});
