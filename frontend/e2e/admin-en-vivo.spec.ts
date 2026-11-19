import { test, expect, type Page } from "@playwright/test";
import {
  blockExternalHosts,
  injectSession,
  mockEmptyNotifications,
  setTheme,
  skipSplash,
} from "./mocks";
import { deContrato } from "./contrato";

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
  employer_return_30d_sample_size: 4,
  employer_return_30d_rate_pct: 50,
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

const AUSENTE = liveShift({
  id: "s4",
  title: "Mozo para el almuerzo",
  company_name: "Bodegón Don Pepe",
  minutes_open: 95,
  no_show_at: agoMinutes(30),
});

function board(filter: string | null) {
  const shifts =
    filter === "no_shows"
      ? [AUSENTE]
      : SHIFTS.filter((s) =>
          filter === "urgent" ? s.urgent : filter === "escalated" ? s.escalated : true
        );
  return {
    generated_at: new Date().toISOString(),
    total: 3,
    urgent: 2,
    escalated: 1,
    no_shows: 1,
    shifts,
  };
}

function period(days: number) {
  const end = new Date("2026-10-24T03:00:00Z").getTime();
  const iso = (ms: number) => new Date(ms).toISOString();
  const start = end - days * 86_400_000;
  const prevStart = start - days * 86_400_000;
  return {
    days,
    // Altas por origen (fase 0 del plan de crecimiento): sólo en 7 días; en
    // 30 llega vacío, como un período sin cuentas nuevas.
    signups_by_origin:
      days === 7
        ? [
            { origin: "grupo-palermo", workers: 3, companies: 1, total: 4 },
            { origin: "ig/fundadores", workers: 0, companies: 2, total: 2 },
            { origin: "directo", workers: 1, companies: 0, total: 1 },
            { origin: null, workers: 2, companies: 0, total: 2 },
          ]
        : [],
    current: {
      start: iso(start),
      end: iso(end),
      shifts_published: days === 7 ? 12 : 40,
      shifts_covered: days === 7 ? 9 : 30,
      covered_pct: 75,
      covered_under_10_min_pct: 67,
      avg_minutes_to_cover: 11,
      applications: days === 7 ? 30 : 95,
      median_minutes_to_cover: 9,
      short_notice_covered: days === 7 ? 6 : 20,
      short_notice_under_10_min_pct: 67,
      fulfilled: days === 7 ? 8 : 27,
      fulfilled_pct: 89,
      active_companies: days === 7 ? 5 : 12,
      companies_with_covered: days === 7 ? 4 : 10,
    },
    previous: {
      start: iso(prevStart),
      end: iso(start),
      shifts_published: days === 7 ? 8 : 40,
      shifts_covered: days === 7 ? 6 : 28,
      covered_pct: 75,
      covered_under_10_min_pct: 50,
      avg_minutes_to_cover: 14,
      applications: days === 7 ? 40 : 0,
      median_minutes_to_cover: 12,
      short_notice_covered: days === 7 ? 4 : 18,
      short_notice_under_10_min_pct: 50,
      fulfilled: days === 7 ? 5 : 25,
      fulfilled_pct: 83,
      active_companies: days === 7 ? 4 : 12,
      companies_with_covered: days === 7 ? 3 : 10,
    },
  };
}

/** Serie semanal M7: cuatro semanas de lunes a lunes (03:00 UTC = 00:00 en
 *  Argentina), de la más vieja a la de hoy, como la manda la API. Armadas
 *  sobre la respuesta real del backend (`e2e/contrato`). */
function weekly() {
  const lunes = (dia: number) => `2026-10-${String(dia).padStart(2, "0")}T03:00:00.000Z`;
  const semana = (
    dia: number,
    numeros: [number, number, number],
    altas: { origin: string | null; workers: number; companies: number }[],
    extra: Record<string, unknown> = {}
  ) => ({
    start: lunes(dia),
    end: lunes(dia + 7),
    in_progress: false,
    shifts_published: numeros[0],
    shifts_covered: numeros[1],
    covered_pct: numeros[0] ? (numeros[1] / numeros[0]) * 100 : null,
    fulfilled: numeros[2],
    fulfilled_pct: numeros[1] ? (numeros[2] / numeros[1]) * 100 : null,
    median_minutes_to_cover: numeros[1] ? 9 : null,
    short_notice_covered: 0,
    short_notice_under_10_min_pct: null,
    active_companies: numeros[0] ? 3 : 0,
    companies_with_covered: numeros[1] ? 2 : 0,
    signups_workers: altas.reduce((n, a) => n + a.workers, 0),
    signups_companies: altas.reduce((n, a) => n + a.companies, 0),
    signups_by_origin: altas.map((a) => ({ ...a, total: a.workers + a.companies })),
    ...extra,
  });
  return deContrato("metricas_semanales", {
    weeks: [
      semana(5, [0, 0, 0], []),
      semana(12, [6, 4, 3], [{ origin: "grupo-palermo", workers: 2, companies: 1 }]),
      semana(19, [8, 6, 6], [
        { origin: "ig/fundadores", workers: 0, companies: 2 },
        { origin: "grupo-palermo", workers: 1, companies: 0 },
      ]),
      semana(26, [3, 1, 0], [{ origin: "directo", workers: 1, companies: 0 }], {
        in_progress: true,
        end: "2026-11-02T03:00:00.000Z",
      }),
    ],
  });
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
  await page.route("**/api/v1/admin/weekly-metrics?**", (route) => route.fulfill(json(weekly())));
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
        : url.searchParams.has("no_shows")
          ? "no_shows"
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

test("Ausencias de hoy lleva a su lista, con la hora de la ausencia", async ({ page }) => {
  await mockAdmin(page);
  const calls = await mockLive(page);
  await page.goto("/admin");

  await page.getByRole("link", { name: /Ausencias de hoy/ }).click();
  await expect(page).toHaveURL("/admin/en-vivo?filtro=ausencias");
  await expect(page.getByRole("button", { name: "Ausencias (1)" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  const list = page.getByRole("list", { name: "Turnos sin cubrir" });
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(list.getByRole("listitem").first()).toContainText("Mozo para el almuerzo");
  await expect(list.getByRole("listitem").first()).toContainText("ausencia");
  expect(calls.at(-1)).toBe("?no_shows=true");
});

test("Métricas muestra las altas del período por origen y por rol", async ({ page }) => {
  await mockAdmin(page);
  await page.goto("/admin/metricas");

  const tabla = page.getByTestId("altas-por-origen");
  const fila = (origen: string) => tabla.getByRole("row", { name: new RegExp(`^${origen}`) });
  await expect(fila("grupo-palermo")).toHaveText(/grupo-palermo\s*3\s*1\s*4/);
  await expect(fila("ig/fundadores")).toHaveText(/ig\/fundadores\s*0\s*2\s*2/);
  await expect(fila("Sin dato")).toBeVisible();
  await expect(fila("Total")).toHaveText(/Total\s*6\s*3\s*9/);
  await expect(tabla).toContainText("«Sin dato»: cuentas creadas antes de que se guardara el origen.");

  await page.getByRole("button", { name: "Últimos 30 días" }).click();
  await expect(tabla).toContainText("Ninguna cuenta nueva en el período.");
});

test("Métricas compara el período con el anterior y cambia a 30 días", async ({ page }) => {
  await mockAdmin(page);
  await page.goto("/admin/metricas");

  // `.first()`: la tarjeta del período; la serie semanal, más abajo, repite
  // algunos rótulos como encabezado de columna.
  const card = (label: string) => page.getByText(label, { exact: true }).first().locator("..");
  await expect(card("Turnos publicados")).toContainText("12");
  await expect(card("Turnos publicados")).toContainText("↑ 50 %");
  await expect(card("Turnos publicados")).toContainText("antes 8");
  // Mediana hasta confirmar: bajar de 12 a 9 min es bueno (verde).
  await expect(card("Mediana hasta confirmar").getByText("↓ 25 %")).toHaveClass(/text-success-text/);
  await expect(card("Locales activos")).toContainText("5");
  await expect(card("Locales activos")).toContainText("4 con un turno cubierto");
  // Postulaciones: bajar de 40 a 30 es malo (rojo).
  await expect(card("Postulaciones").getByText("↓ 25 %")).toHaveClass(/text-danger-text/);
  await expect(page.getByText("Período: 17/10 al 23/10")).toBeVisible();

  await page.getByRole("button", { name: "Últimos 30 días" }).click();
  await expect(page.getByText("Contra los 30 días anteriores", { exact: false })).toBeVisible();
  await expect(card("Postulaciones")).toContainText("↑ desde 0");
  await expect(card("Turnos publicados")).toContainText("= igual");
  await expect(page.getByText("Hoy, sin comparación por período.")).toBeVisible();
});

test("Métricas muestra la serie semana por semana y la baja en CSV", async ({ page }) => {
  await mockAdmin(page);
  const pedidos: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/admin/weekly-metrics")) pedidos.push(new URL(r.url()).search);
  });
  await page.goto("/admin/metricas");

  const serie = page.getByTestId("serie-semanal");
  const tablas = serie.getByRole("table");
  const semanas = tablas.first();
  // La más nueva primero, marcada «en curso».
  await expect(semanas.getByRole("row").nth(1)).toHaveText(/^26\/10\s*en curso\s*3\s*1\s*33%\s*0\s*0%/);
  await expect(semanas.getByRole("row", { name: /^19\/10/ })).toHaveText(
    /19\/10\s*8\s*6\s*75%\s*6\s*100%\s*9 min\s*3\s*1\s*2/
  );
  await expect(semanas.getByRole("row", { name: /^5\/10/ })).toContainText("—");

  const origenes = tablas.nth(1);
  await expect(origenes.getByRole("row").first()).toHaveText(/Origen\s*26\/10\s*19\/10\s*12\/10\s*5\/10/);
  await expect(origenes.getByRole("row", { name: /^grupo-palermo/ })).toHaveText(
    /grupo-palermo\s*—\s*1 · 0\s*2 · 1\s*—/
  );
  await expect(origenes.getByRole("row", { name: /^ig\/fundadores/ })).toHaveText(
    /ig\/fundadores\s*—\s*0 · 2\s*—\s*—/
  );

  const descarga = page.waitForEvent("download");
  await serie.getByRole("button", { name: "CSV" }).click();
  const archivo = await descarga;
  expect(archivo.suggestedFilename()).toBe("oido-semanas-desde-2026-10-05.csv");
  const texto = await (await archivo.createReadStream()).toArray();
  const csv = Buffer.concat(texto).toString("utf-8").replace(/^\uFEFF/, "").split("\n");
  expect(csv[0]).toContain("semana,en curso,publicados,cubiertos");
  expect(csv[0]).toContain("altas grupo-palermo trabajadores,altas grupo-palermo comercios");
  expect(csv[1].startsWith("2026-10-05,no,0,0,")).toBe(true);
  expect(csv[4].startsWith("2026-10-26,sí,3,1,33.3,0,0,9,")).toBe(true);

  await serie.getByRole("button", { name: "26 semanas" }).click();
  await expect.poll(() => pedidos).toEqual(["?weeks=12", "?weeks=26"]);
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
