import { test, expect, type Page } from "@playwright/test";
import {
  blockExternalHosts,
  injectSession,
  mockEmptyNotifications,
  setTheme,
  skipSplash,
} from "./mocks";

/**
 * Pasos 3 y 4 del panel de admin ordenado (2026-10-20): "Turnos en vivo",
 * los contadores de hoy en la portada y "Métricas" con período.
 */

const ADMIN_SESSION = {
  id: "admin-1",
  email: "julietaarrazate@gmail.com",
  full_name: "Julieta Arrazate",
  role: "admin",
  status: "active",
  is_active: true,
  is_verified: true,
};

const STATS = {
  total_users: 12,
  workers: 7,
  employers: 4,
  admins: 1,
  active: 11,
  suspended: 1,
  verified: 9,
  coverage_sample_size: 5,
  avg_time_to_fill_minutes: 8,
  pct_filled_under_10_min: 80,
  shift_assignment_rate_sample_size: 10,
  shift_assignment_rate_pct: 70,
  shift_completion_rate_sample_size: 10,
  shift_completion_rate_pct: 50,
  application_acceptance_sample_size: 20,
  application_to_acceptance_rate_pct: 35,
  no_show_sample_size: 8,
  no_show_rate_pct: 12.5,
  worker_completion_repeat_sample_size: 6,
  worker_completion_repeat_rate_pct: 33,
  employer_repeat_sample_size: 4,
  employer_repeat_rate_pct: 50,
};

const json = (body: unknown) => ({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify(body),
});

const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
const agoMinutes = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

function liveShift(overrides: Record<string, unknown>) {
  return {
    id: "s0",
    title: "Mozo para la cena",
    position: "mozo",
    status: "buscando_personal",
    start_at: inHours(3),
    end_at: inHours(9),
    city: "Palermo",
    company_name: "Bodegón Don Pepe",
    urgent: false,
    escalated: false,
    escalated_at: null,
    published_at: agoMinutes(5),
    minutes_open: 5,
    applications: 0,
    ...overrides,
  };
}

const SHIFTS = [
  liveShift({
    id: "s1",
    title: "Bartender para un casamiento",
    position: "bartender",
    company_name: "Salón Las Heras",
    urgent: true,
    escalated: true,
    escalated_at: agoMinutes(12),
    minutes_open: 42,
    applications: 1,
  }),
  liveShift({
    id: "s2",
    title: "Cocinero para el mediodía",
    position: "cocinero",
    company_name: "Parrilla El Ceibo",
    city: "Villa Crespo",
    urgent: true,
    minutes_open: 7,
    applications: 3,
  }),
  liveShift({
    id: "s3",
    title: "Mozo para la cena",
    status: "asignado",
    minutes_open: 18,
    applications: 2,
  }),
];

function board(filter: string | null) {
  const shifts = SHIFTS.filter((s) =>
    filter === "urgent" ? s.urgent : filter === "escalated" ? s.escalated : true
  );
  return { generated_at: new Date().toISOString(), total: 3, urgent: 2, escalated: 1, shifts };
}

function period(days: number) {
  const end = new Date("2026-10-24T03:00:00Z").getTime();
  const iso = (ms: number) => new Date(ms).toISOString();
  const start = end - days * 86_400_000;
  const prevStart = start - days * 86_400_000;
  return {
    days,
    current: {
      start: iso(start),
      end: iso(end),
      shifts_published: days === 7 ? 12 : 40,
      shifts_covered: days === 7 ? 9 : 30,
      covered_pct: 75,
      covered_under_10_min_pct: 67,
      avg_minutes_to_cover: 9,
      applications: days === 7 ? 30 : 95,
    },
    previous: {
      start: iso(prevStart),
      end: iso(start),
      shifts_published: days === 7 ? 8 : 40,
      shifts_covered: days === 7 ? 6 : 28,
      covered_pct: 75,
      covered_under_10_min_pct: 50,
      avg_minutes_to_cover: 12,
      applications: days === 7 ? 40 : 0,
    },
  };
}

async function mockAdmin(page: Page) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) => route.fulfill(json(ADMIN_SESSION)));
  await page.route("**/api/v1/admin/stats", (route) => route.fulfill(json(STATS)));
  await page.route("**/api/v1/admin/today", (route) =>
    route.fulfill(json({ urgent_uncovered: 2, no_shows_today: 1 }))
  );
  await page.route("**/api/v1/identity/claims/pending", (route) => route.fulfill(json([])));
  await page.route("**/api/v1/support/tickets?**", (route) => route.fulfill(json([])));
  await page.route("**/api/v1/admin/leads/summary**", (route) =>
    route.fulfill(json({ counts: { nuevo: 0 }, total: 0 }))
  );
  await page.route("**/api/v1/admin/subscription-stats", (route) =>
    route.fulfill(
      json({
        mrr_ars: "150000",
        total_companies: 4,
        companies_by_plan: { inicial: 2, basico: 1, pro: 1 },
        companies_at_plan_limit: 1,
        billing_enabled: true,
      })
    )
  );
  await page.route("**/api/v1/admin/period-metrics?**", (route) => {
    const days = Number(new URL(route.request().url()).searchParams.get("period"));
    return route.fulfill(json(period(days)));
  });
}

async function mockLive(page: Page): Promise<string[]> {
  const calls: string[] = [];
  await page.route("**/api/v1/admin/live-shifts**", (route) => {
    const url = new URL(route.request().url());
    calls.push(url.search);
    const filter = url.searchParams.has("urgent")
      ? "urgent"
      : url.searchParams.has("escalated")
        ? "escalated"
        : null;
    return route.fulfill(json(board(filter)));
  });
  return calls;
}

test("Turnos en vivo lista lo que falta cubrir y filtra urgentes y escalados", async ({ page }) => {
  await mockAdmin(page);
  await mockLive(page);
  await page.goto("/admin/en-vivo");

  await expect(page.getByRole("heading", { name: "Turnos en vivo" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Secciones del panel" });
  await expect(nav.getByRole("link", { name: "Turnos en vivo 2" })).toHaveAttribute(
    "aria-current",
    "page"
  );

  const list = page.getByRole("list", { name: "Turnos sin cubrir" });
  await expect(list.getByRole("listitem")).toHaveCount(3);
  const first = list.getByRole("listitem").first();
  await expect(first).toContainText("Bartender para un casamiento");
  await expect(first).toContainText("Salón Las Heras");
  await expect(first).toContainText("42 min");
  await expect(first).toContainText("Escalado hace 12 min");
  await expect(first).toContainText("1 postulación");
  await expect(list.getByText("Asignado, falta que confirme")).toBeVisible();

  await page.getByRole("button", { name: "Escalados (1)" }).click();
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(page).toHaveURL(/filtro=escalados/);

  await page.getByRole("button", { name: "Urgentes (2)" }).click();
  await expect(list.getByRole("listitem")).toHaveCount(2);
});

test("Turnos en vivo se actualiza sola cada 30 segundos", async ({ page }) => {
  await page.clock.install();
  await mockAdmin(page);
  const calls = await mockLive(page);
  await page.goto("/admin/en-vivo?filtro=urgentes");

  await expect(page.getByRole("button", { name: "Urgentes (2)" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect.poll(() => calls.length).toBeGreaterThanOrEqual(1);
  const before = calls.length;
  await page.clock.fastForward(30_000);
  await expect.poll(() => calls.length).toBeGreaterThan(before);
  expect(calls.at(-1)).toBe("?urgent=true");
});

test("sin turnos esperando, lo dice", async ({ page }) => {
  await mockAdmin(page);
  await page.route("**/api/v1/admin/live-shifts**", (route) =>
    route.fulfill(
      json({ generated_at: new Date().toISOString(), total: 0, urgent: 0, escalated: 0, shifts: [] })
    )
  );
  await page.goto("/admin/en-vivo");
  await expect(page.getByText("Nada esperando")).toBeVisible();
});

test("Hoy suma urgentes sin cubrir y ausencias del día", async ({ page }) => {
  await mockAdmin(page);
  await mockLive(page);
  await page.goto("/admin");

  const urgentes = page.getByRole("link", { name: /Urgentes sin cubrir/ });
  await expect(urgentes).toContainText("2");
  await expect(page.getByRole("link", { name: /Ausencias de hoy/ })).toContainText("1");
  await urgentes.click();
  await expect(page).toHaveURL("/admin/en-vivo?filtro=urgentes");
  await expect(page.getByRole("list", { name: "Turnos sin cubrir" }).getByRole("listitem")).toHaveCount(2);
});

test("Métricas compara el período con el anterior y cambia a 30 días", async ({ page }) => {
  await mockAdmin(page);
  await page.goto("/admin/metricas");

  const card = (label: string) => page.getByText(label, { exact: true }).locator("..");
  await expect(card("Turnos publicados")).toContainText("12");
  await expect(card("Turnos publicados")).toContainText("↑ 50 %");
  await expect(card("Turnos publicados")).toContainText("antes 8");
  // Tiempo hasta cubrir: bajar de 12 a 9 min es bueno (verde).
  await expect(card("Tiempo hasta cubrir").getByText("↓ 25 %")).toHaveClass(/text-success-text/);
  // Postulaciones: bajar de 40 a 30 es malo (rojo).
  await expect(card("Postulaciones").getByText("↓ 25 %")).toHaveClass(/text-danger-text/);
  await expect(page.getByText("Período: 17/10 al 23/10")).toBeVisible();

  await page.getByRole("button", { name: "Últimos 30 días" }).click();
  await expect(page.getByText("Contra los 30 días anteriores", { exact: false })).toBeVisible();
  await expect(card("Postulaciones")).toContainText("↑ desde 0");
  await expect(card("Turnos publicados")).toContainText("= igual");
  await expect(page.getByText("Hoy, sin comparación por período.")).toBeVisible();
});

for (const theme of ["light", "dark"] as const) {
  for (const viewport of [
    { name: "390", width: 390, height: 844 },
    { name: "1280", width: 1280, height: 900 },
  ]) {
    for (const screen of [
      { name: "en-vivo", path: "/admin/en-vivo", ready: "Bartender para un casamiento" },
      { name: "hoy", path: "/admin", ready: "Urgentes sin cubrir" },
      { name: "metricas", path: "/admin/metricas", ready: "Últimos 7 días" },
    ]) {
      test(`captura de ${screen.name} en ${theme}, ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await setTheme(page, theme);
        await mockAdmin(page);
        await mockLive(page);
        await page.goto(screen.path);
        await expect(page.getByText(screen.ready).first()).toBeVisible();
        await expect(page.getByText("80%").or(page.getByText("Actualizado")).first()).toBeVisible();
        await page.screenshot({
          path: `test-results/admin-${screen.name}-${theme}-${viewport.name}.png`,
          fullPage: true,
        });
      });
    }
  }
}
