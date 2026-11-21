import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

const json = (body: unknown, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const ADMIN = { id: "admin-1", email: "julietaarrazate@gmail.com", full_name: "Julieta Arrazate", role: "admin", status: "active", is_active: true, is_verified: true };
const NOMBRES = ["Ana Mozo", "Pepe Bodegón", "María de los Ángeles Fernández de la Vega Rodríguez Alcántara-Montenegro", "Beto Cocina", "Caro Barra", "Dante Salón", "Eli Runner", "Fede Chef", "Gabi Mozo", "Hugo Bartender"];
const USERS = NOMBRES.map((n, i) => ({ id: `u${i}`, email: i === 2 ? "maria.de.los.angeles.fernandez.de.la.vega.alcantara@correo-larguisimo-ejemplo.com.ar" : `${n.split(" ")[0].toLowerCase()}@mail.com`, full_name: n, role: i % 3 === 1 ? "employer" : "worker", status: i === 1 ? "suspended" : "active", is_verified: i % 2 === 0, created_at: "2026-09-01T12:00:00Z", photo_url: null }));
const STATS = { total_users: 120, workers: 70, employers: 40, admins: 1, active: 110, suspended: 3, verified: 90, coverage_sample_size: 15, avg_time_to_fill_minutes: 8, pct_filled_under_10_min: 80, shift_assignment_rate_sample_size: 10, shift_assignment_rate_pct: 70, shift_completion_rate_sample_size: 10, shift_completion_rate_pct: 50, application_acceptance_sample_size: 20, application_to_acceptance_rate_pct: 35, no_show_sample_size: 8, no_show_rate_pct: 12.5, worker_completion_repeat_sample_size: 6, worker_completion_repeat_rate_pct: 66, employer_return_30d_sample_size: 4, employer_return_30d_rate_pct: 25 };
const PS = (n: number) => ({ start: "2026-11-14", end: "2026-11-21", shifts_published: n, shifts_covered: n - 2, covered_pct: 80, covered_under_10_min_pct: 60, avg_minutes_to_cover: 12, applications: 40, median_minutes_to_cover: 9, short_notice_covered: 5, short_notice_under_10_min_pct: 50, fulfilled: 6, fulfilled_pct: 90, active_companies: 8, companies_with_covered: 6 });
const WEEKS = Array.from({ length: 6 }, (_, i) => ({ start: `2026-10-${12 + i * 7}`, end: `2026-10-${18 + i * 7}`, in_progress: i === 5, shifts_published: 10 + i, shifts_covered: 8 + i, covered_pct: 80, fulfilled: 6, fulfilled_pct: 85, median_minutes_to_cover: 9, short_notice_covered: 3, short_notice_under_10_min_pct: 50, active_companies: 6, companies_with_covered: 5, signups_workers: 4 + i, signups_companies: 2, signups_by_origin: [] }));
const DETAIL = (id: string) => {
  const u = USERS.find((x) => x.id === id) ?? USERS[0];
  const emp = u.role === "employer";
  return { user: u, worker: emp ? null : { city: "Palermo", skills: ["mozo", "bartender"], years_experience: 3, is_available: true, rating: 4.6, events_completed: 12, punctuality_rate: 0.92, cancellations: 1, no_shows: 0, level: "plata" }, company: emp ? { name: "Bodegón Pepe", category: "bodegon", address: "Thames 1234", city: "Palermo", rating: 4.2, events_published: 20, on_time_payment_rate: 0.9, payments_recorded: 10, late_cancellations: 1 } : null,
    recent_shifts: [1, 2, 3].map((k) => ({ id: `s${k}`, title: k === 1 ? "Mozo para cena de egresados con nombre muy largo de verdad" : "Mozo para cena", position: "mozo", start_at: "2026-10-18T23:00:00Z", status: "finalizado", pay_amount: "25000.00" })),
    tickets: [{ id: "t1", subject: "No me llegan avisos", status: "abierto", created_at: "2026-10-19T12:00:00Z" }] };
};

async function mock(page: Page, opts: { vacio?: boolean } = {}) {
  await injectSession(page); await skipSplash(page); await blockExternalHosts(page); await mockEmptyNotifications(page);
  await page.route("**/api/v1/**", (r) => r.fulfill(json([])));
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json(ADMIN)));
  await page.route("**/api/v1/admin/stats", (r) => r.fulfill(json(STATS)));
  await page.route("**/api/v1/admin/today", (r) => r.fulfill(json({ urgent_uncovered: 2, no_shows_today: 1 })));
  await page.route("**/api/v1/identity/claims/pending", (r) => r.fulfill(json(opts.vacio ? [] : ["Ana", "Beto"].map((n, i) => ({ claim_id: `c${i}`, user_id: `u${i}`, claim_type: "documento_verificado", full_name: `${n} Prueba`, company_name: null, submitted_at: "2026-10-20T12:00:00Z", evidences: [] })))));
  await page.route("**/api/v1/support/tickets?**", (r) => r.fulfill(json(opts.vacio ? [] : [{ id: "t1", subject: "No me llegan avisos", status: "abierto", created_at: "2026-10-19T12:00:00Z", category: "otro", user_name: "Ana" }])));
  await page.route("**/api/v1/admin/leads/summary**", (r) => r.fulfill(json({ counts: { nuevo: 14, contactado: 3, visitado: 0, interesado: 1, alta: 0, descartado: 2 }, total: 20 })));
  await page.route(/\/api\/v1\/admin\/users\?/, (r) => r.fulfill(json(opts.vacio ? [] : USERS)));
  await page.route(/\/api\/v1\/admin\/users\/u\d+$/, (r) => r.fulfill(json(DETAIL(new URL(r.request().url()).pathname.split("/").pop()!))));
  await page.route("**/api/v1/admin/period-metrics**", (r) => r.fulfill(json({ days: 7, current: PS(10), previous: PS(8), signups_by_origin: [{ origin: "instagram", workers: 3, companies: 1, total: 4 }, { origin: null, workers: 1, companies: 0, total: 1 }] })));
  await page.route("**/api/v1/admin/weekly-metrics**", (r) => r.fulfill(json({ weeks: WEEKS })));
  await page.route("**/api/v1/admin/subscription-stats", (r) => r.fulfill(json({ mrr_ars: "150000", total_companies: 40, companies_by_plan: { inicial: 30, pro: 10 }, companies_at_plan_limit: 2, billing_enabled: false, committed_companies: 3, committed_mrr_ars: "45000" })));
  await page.route("**/api/v1/auth/2fa", (r) => r.fulfill(json({ enabled: true, enabled_at: "2026-10-01T12:00:00Z", recovery_codes_left: 8 })));
  await page.route("**/api/v1/admin/live-shifts**", (r) => r.fulfill(json({ generated_at: "2026-11-21T15:00:00Z", total: 3, urgent: 1, escalated: 1, no_shows: 1, shifts: [1, 2, 3].map((k) => ({ id: `l${k}`, title: k === 1 ? "Cobertura de salón para el evento de la empresa con un título larguísimo" : "Barra", position: "mozo", status: "publicado", start_at: "2026-11-21T22:00:00Z", end_at: "2026-11-22T02:00:00Z", city: "Palermo", company_name: "Bodegón Pepe", urgent: k === 1, escalated: k === 1, escalated_at: null, published_at: "2026-11-21T14:00:00Z", minutes_open: 25 * k, applications: k })) })));
  await page.route("**/api/v1/admin/leads?**", (r) => r.fulfill(json(opts.vacio ? [] : [1, 2, 3].map((k) => ({ id: `ld${k}`, osm_ref: `n${k}`, name: k === 1 ? "Restaurante con un nombre larguísimo que no entra en una línea del celular" : `Bar ${k}`, kind: "restaurante", barrio: "Palermo", latitude: -34.5, longitude: -58.4, address: "Thames 1234", phone: "+5411", website: null, instagram: "@bar", email: null, status: "nuevo", notes: "", priority: 1, contacted_at: null, updated_at: null })))));
}


/**
 * La Administración con la dirección suave (ADR-0028, 2026-11-21): una sola
 * cáscara para todas las pantallas (cielo corto y liso + hoja con el menú),
 * sin el relieve de antes, con un solo ámbar y sin scroll horizontal.
 */
const RUTAS = [
  "/admin",
  "/admin/en-vivo",
  "/admin/personas",
  "/admin/personas/u2",
  "/admin/verificacion",
  "/admin/support",
  "/admin/leads",
  "/admin/metricas",
  "/admin/herramientas",
  "/admin/seguridad",
];

for (const theme of ["light", "dark"] as const) {
  for (const ruta of RUTAS) {
    test(`${ruta} lleva la cáscara suave en ${theme}`, async ({ page }) => {
      await mock(page);
      await setTheme(page, theme);
      await page.goto(ruta);
      const raiz = page.locator(".estilo-suave.admin-suave");
      await expect(raiz).toHaveCount(1);
      // El cielo es corto y liso (sin nubes grandes) y el título va sobre él.
      await expect(raiz.locator(".app-cielo.cielo-limpio h1.titulo-pantalla")).toHaveCount(1);
      await expect(raiz.locator(".hoja")).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByRole("navigation", { name: "Secciones del panel" })).toBeVisible();
      // Nada del relieve de antes, y un solo ámbar como mucho.
      await expect(page.locator(".tarjeta-relieve")).toHaveCount(0);
      expect(await page.locator(".boton-relieve").count()).toBeLessThanOrEqual(1);
      // Sin letra de brocha ni serif en el contenido de la hoja.
      const familias = await page.locator(".admin-hoja *").evaluateAll((els) =>
        els.filter((el) => /serif|brush|display/i.test(getComputedStyle(el).fontFamily) && !/sans/i.test(getComputedStyle(el).fontFamily)).length
      );
      expect(familias).toBe(0);
      const ancho = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(ancho).toBeLessThanOrEqual(0);
    });
  }
}

test("en la compu la hoja aprovecha el ancho y el menú queda a la izquierda", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mock(page);
  await page.goto("/admin/personas");
  const hoja = await page.locator(".admin-hoja").boundingBox();
  const menu = await page.getByRole("navigation", { name: "Secciones del panel" }).boundingBox();
  const lista = await page.locator(".perfil-filas").boundingBox();
  expect(hoja!.width).toBeGreaterThan(1000);
  expect(menu!.x).toBeLessThan(lista!.x);
  expect(lista!.width).toBeGreaterThan(700);
});

test("la ficha vuelve a Personas desde el botón del cielo", async ({ page }) => {
  await mock(page);
  await page.goto("/admin/personas/u2");
  await page.getByRole("link", { name: "Volver a Personas" }).click();
  await expect(page).toHaveURL("/admin/personas");
});

test("sin scroll horizontal a 320 px ni con la letra al 200 %", async ({ page }) => {
  for (const [w, fs] of [[320, "100%"], [390, "200%"]] as const) {
    await page.setViewportSize({ width: w, height: 800 });
    await mock(page);
    for (const ruta of RUTAS) {
      await page.goto(ruta);
      await page.addStyleTag({ content: `html{font-size:${fs}!important}` });
      await page.waitForTimeout(300);
      const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(o, `${ruta} a ${w}px con letra ${fs}`).toBeLessThanOrEqual(0);
    }
  }
});

test("el perfil del admin lleva la misma dirección: cielo corto, hoja y filas suaves", async ({ page }) => {
  await mock(page);
  await page.goto("/profile");
  await expect(page.locator(".estilo-suave .app-cielo.cielo-limpio")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1, name: "Perfil" })).toBeVisible();
  await expect(page.getByText("Administrador", { exact: true })).toBeVisible();
  await expect(page.locator(".perfil-filas").getByRole("link", { name: "Ajustes" })).toBeVisible();
  await expect(page.locator(".tarjeta-relieve")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});
