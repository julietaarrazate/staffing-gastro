import { test, expect, type Page } from "@playwright/test";
import {
  blockExternalHosts,
  injectSession,
  mockEmptyNotifications,
  setTheme,
  skipSplash,
} from "./mocks";

/**
 * "Personas" del panel de admin (paso 2, 2026-10-20): buscador y filtros
 * que viajan al backend, y la ficha con perfil, turnos, tickets y acciones.
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

const ANA = {
  id: "u-ana",
  email: "ana.mozo@mail.com",
  full_name: "Ana Mozo",
  role: "worker",
  status: "active",
  is_verified: false,
  created_at: "2026-09-01T12:00:00Z",
  photo_url: null,
};

const PEPE = {
  id: "u-pepe",
  email: "pepe@bodegon.com",
  full_name: "Pepe Bodegón",
  role: "employer",
  status: "suspended",
  is_verified: true,
  created_at: "2026-08-15T12:00:00Z",
  photo_url: null,
};

const ANA_DETAIL = {
  user: ANA,
  worker: {
    city: "Palermo",
    skills: ["mozo", "bartender"],
    years_experience: 3,
    is_available: true,
    rating: 4.6,
    events_completed: 12,
    punctuality_rate: 0.92,
    cancellations: 1,
    no_shows: 0,
    level: "plata",
  },
  company: null,
  recent_shifts: [
    {
      id: "s1",
      title: "Mozo para cena",
      position: "mozo",
      start_at: "2026-10-18T23:00:00Z",
      status: "finalizado",
      pay_amount: "25000.00",
    },
  ],
  tickets: [
    { id: "t1", subject: "No me llegan avisos", status: "abierto", created_at: "2026-10-19T12:00:00Z" },
  ],
};

const json = (body: unknown) => ({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify(body),
});

async function setup(page: Page, queries: string[] = [], actions: string[] = []) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) => route.fulfill(json(ADMIN_SESSION)));
  // Contadores del menú (layout de /admin).
  await page.route("**/api/v1/identity/claims/pending", (route) => route.fulfill(json([])));
  await page.route("**/api/v1/support/tickets?**", (route) => route.fulfill(json([])));
  await page.route("**/api/v1/admin/leads/summary**", (route) =>
    route.fulfill(json({ counts: { nuevo: 0 }, total: 0 }))
  );
  await page.route(/\/api\/v1\/admin\/users\?/, (route) => {
    const url = new URL(route.request().url());
    queries.push(url.search);
    const q = url.searchParams.get("q")?.toLowerCase() ?? "";
    const role = url.searchParams.get("role");
    const people = [ANA, PEPE].filter(
      (p) =>
        (!q || p.full_name.toLowerCase().includes(q) || p.email.includes(q)) &&
        (!role || p.role === role)
    );
    return route.fulfill(json(people));
  });
  await page.route("**/api/v1/admin/users/u-ana", (route) => route.fulfill(json(ANA_DETAIL)));
  await page.route("**/api/v1/admin/users/u-ana/*", (route) => {
    actions.push(new URL(route.request().url()).pathname.split("/").pop() ?? "");
    return route.fulfill(json({ ...ANA, is_verified: true }));
  });
}

test("busca por nombre, filtra por rol y abre la ficha", async ({ page }) => {
  const queries: string[] = [];
  await setup(page, queries);
  await page.goto("/admin/personas");

  await expect(page.getByText("Ana Mozo")).toBeVisible();
  await expect(page.getByText("Pepe Bodegón")).toBeVisible();
  await expect(page.getByText("Suspendido", { exact: true })).toBeVisible();

  await page.getByLabel("Buscar por nombre o email").fill("ana");
  await expect(page.getByText("Pepe Bodegón")).toHaveCount(0);
  await expect.poll(() => queries.some((q) => q.includes("q=ana"))).toBe(true);

  await page.getByLabel("Buscar por nombre o email").fill("");
  await page.getByRole("button", { name: "Comercios" }).click();
  await expect(page.getByText("Ana Mozo")).toHaveCount(0);
  await expect.poll(() => queries.some((q) => q.includes("role=employer"))).toBe(true);

  await page.getByRole("button", { name: "Todos" }).click();
  await page.getByRole("link", { name: /Ana Mozo/ }).click();
  await expect(page).toHaveURL("/admin/personas/u-ana");
  await expect(page.getByRole("heading", { name: "Ana Mozo" })).toBeVisible();
  await expect(page.getByText("Turnos completados")).toBeVisible();
  await expect(page.getByText("Mozo para cena")).toBeVisible();
  await expect(page.getByText("No me llegan avisos")).toBeVisible();
});

test("desde la ficha se verifica a la persona", async ({ page }) => {
  const actions: string[] = [];
  await setup(page, [], actions);
  await page.goto("/admin/personas/u-ana");
  await page.getByRole("button", { name: "Verificar" }).click();
  await expect.poll(() => actions).toEqual(["verify"]);
});

test("una ficha inexistente lo dice", async ({ page }) => {
  await setup(page);
  await page.route("**/api/v1/admin/users/no-existe", (route) =>
    route.fulfill({ status: 404, contentType: "application/json", body: '{"detail":"Usuario no encontrado"}' })
  );
  await page.goto("/admin/personas/no-existe");
  await expect(page.getByText("No encontramos a esta persona")).toBeVisible();
});

test("suspender pide confirmación antes de actuar", async ({ page }) => {
  const actions: string[] = [];
  await setup(page, [], actions);
  await page.goto("/admin/personas/u-ana");
  await page.getByRole("button", { name: "Suspender", exact: true }).click();
  await expect(page.getByText("¿Suspender a Ana Mozo?")).toBeVisible();
  await page.getByRole("button", { name: "Volver" }).click();
  expect(actions).toEqual([]);

  await page.getByRole("button", { name: "Suspender", exact: true }).click();
  await page.getByRole("button", { name: "Sí, suspender" }).click();
  await expect.poll(() => actions).toEqual(["suspend"]);
});

for (const theme of ["light", "dark"] as const) {
  test(`capturas de Personas y la ficha en ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setTheme(page, theme);
    await setup(page);
    await page.goto("/admin/personas");
    await expect(page.getByText("Pepe Bodegón")).toBeVisible();
    await page.screenshot({ path: `test-results/admin-personas-${theme}.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/personas/u-ana");
    await expect(page.getByText("Mozo para cena")).toBeVisible();
    await page.screenshot({ path: `test-results/admin-ficha-${theme}.png`, fullPage: true });
  });
}
