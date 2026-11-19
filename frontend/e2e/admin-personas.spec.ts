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

// Ana está asignada o confirmada en dos turnos que no empezaron: si se la
// suspende, vuelven a buscar personal (ADR-0024).
const ANA_PREVIEW = { hidden: 0, cancelled: 0, reopened: 2 };

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
    const action = new URL(route.request().url()).pathname.split("/").pop() ?? "";
    // Mirar la vista previa no es una acción: no cambia nada.
    if (action === "suspension-preview") return route.fulfill(json(ANA_PREVIEW));
    actions.push(action);
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

  await page.getByLabel("Buscar por nombre, email o nombre del local").fill("ana");
  await expect(page.getByText("Pepe Bodegón")).toHaveCount(0);
  await expect.poll(() => queries.some((q) => q.includes("q=ana"))).toBe(true);

  await page.getByLabel("Buscar por nombre, email o nombre del local").fill("");
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
  // Antes de confirmar se ve qué les pasa a sus turnos.
  await expect(
    page.getByText(
      "2 turnos suyos vuelven a buscar personal. Le avisamos a cada comercio, sin sumarle una cancelación."
    )
  ).toBeVisible();
  await page.getByRole("button", { name: "Volver" }).click();
  expect(actions).toEqual([]);

  await page.getByRole("button", { name: "Suspender", exact: true }).click();
  await page.getByRole("button", { name: "Sí, suspender" }).click();
  await expect.poll(() => actions).toEqual(["suspend"]);
});

test("mientras cuenta los turnos no se puede confirmar, y si no puede contarlos lo dice", async ({
  page,
}) => {
  await setup(page);
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/v1/admin/users/u-ana/suspension-preview", async (route) => {
    await held;
    return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
  });
  await page.goto("/admin/personas/u-ana");
  await page.getByRole("button", { name: "Suspender", exact: true }).click();
  await expect(page.getByText("Contando sus turnos…")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sí, suspender" })).toBeDisabled();
  release();
  await expect(page.getByText("No pudimos contar sus turnos.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sí, suspender" })).toBeEnabled();
});

for (const theme of ["light", "dark"] as const) {
  test(`captura del diálogo de suspender con sus turnos en ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setTheme(page, theme);
    await setup(page);
    await page.route("**/api/v1/admin/users/u-ana/suspension-preview", (route) =>
      route.fulfill(json({ hidden: 3, cancelled: 1, reopened: 0 }))
    );
    await page.goto("/admin/personas/u-ana");
    await page.getByRole("button", { name: "Suspender", exact: true }).click();
    await expect(page.getByText("Se ocultan 3 turnos abiertos", { exact: false })).toBeVisible();
    // La foto, con el diálogo ya entrado (no a mitad de la animación).
    await page.waitForFunction(() =>
      document.getAnimations().every((a) => a.playState !== "running")
    );
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await page.screenshot({ path: `test-results/admin-suspender-${theme}.png` });
  });

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

// Un solo indicador de foco (#627): el buscador dibuja el contorno en su
// contenedor (`.foco-contenedor`) y el input no suma otro encima.
test("el buscador de personas enfocado tiene un solo contorno, en el contenedor", async ({ page }) => {
  await setup(page);
  await page.goto("/admin/personas");
  const campo = page.getByLabel("Buscar por nombre, email o nombre del local");
  await campo.click();
  const contenedor = campo.locator("xpath=ancestor::label[1]");
  await expect.poll(() => contenedor.evaluate((n) => getComputedStyle(n).outlineWidth)).toBe("2px");
  expect(await campo.evaluate((n) => getComputedStyle(n).outlineStyle)).toBe("none");
});

// «Cerrar turno» (decisión 21, ADR-0024): un turno empezado de una cuenta
// suspendida. Qué aplica lo dice el backend (`admin_close`); la ficha lo
// ofrece, lo explica antes de confirmar y muestra el resultado.
const LEO = {
  id: "u-leo",
  email: "leo@mail.com",
  full_name: "Leo Barra",
  role: "worker",
  status: "suspended",
  is_verified: true,
  created_at: "2026-09-10T12:00:00Z",
  photo_url: null,
};

const LEO_SHIFT = {
  id: "s-leo",
  title: "Barra del viernes",
  position: "bartender",
  start_at: "2026-11-18T22:00:00Z",
  status: "check_in",
  pay_amount: "30000.00",
};

function leoDetail(closed: boolean) {
  return {
    ...ANA_DETAIL,
    user: LEO,
    recent_shifts: [
      closed
        ? { ...LEO_SHIFT, status: "check_out", admin_close: null }
        : {
            ...LEO_SHIFT,
            admin_close: { check_out: true, finish: false, notifies: "company" },
          },
      // Ya terminado: la acción no aplica.
      { ...ANA_DETAIL.recent_shifts[0], id: "s-viejo", admin_close: null },
    ],
    tickets: [],
  };
}

async function setupLeo(page: Page, closes: string[]) {
  await setup(page);
  let closed = false;
  await page.route("**/api/v1/admin/users/u-leo", (route) =>
    route.fulfill(json(leoDetail(closed)))
  );
  await page.route("**/api/v1/admin/shifts/*/close", (route) => {
    closes.push(
      `${new URL(route.request().url()).pathname} ${route.request().postData() ?? ""}`
    );
    closed = true;
    return route.fulfill(
      json({
        shift_id: "s-leo",
        status: "check_out",
        check_out: true,
        finish: false,
        notifies: "company",
        checked_out_at: new Date().toISOString(),
      })
    );
  });
}

test("cerrar el turno empezado de una cuenta suspendida: explica, confirma y muestra el resultado", async ({
  page,
}) => {
  const closes: string[] = [];
  await setupLeo(page, closes);
  await page.goto("/admin/personas/u-leo");

  await expect(page.getByText("Barra del viernes")).toBeVisible();
  // Sólo en el turno donde aplica.
  await expect(page.getByRole("button", { name: "Cerrar turno" })).toHaveCount(1);
  await expect(page.getByText("No puede entrar a marcar la salida.")).toBeVisible();

  await page.getByRole("button", { name: "Cerrar turno" }).click();
  const dialog = page.getByRole("dialog", { name: "¿Cerrar «Barra del viernes»?" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText(/^Marcamos la salida de la persona a las \d\d:\d\d, en su nombre\.$/)
  ).toBeVisible();
  await expect(
    dialog.getByText("Le avisamos al comercio para que cierre el turno, como siempre.")
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Volver" }).click();
  expect(closes).toEqual([]);

  await page.getByRole("button", { name: "Cerrar turno" }).click();
  await page.getByRole("button", { name: "Sí, cerrar turno" }).click();
  await expect(
    page.getByText(/^Marcamos la salida a las \d\d:\d\d\. Le avisamos al comercio para que lo cierre\.$/)
  ).toBeVisible();
  // Manda lo que mostró el diálogo: si el backend haría otra cosa, responde 409.
  expect(closes).toEqual(['/api/v1/admin/shifts/s-leo/close {"check_out":true,"finish":false}']);
  await page.getByRole("button", { name: "Entendido" }).click();
  // La ficha se recargó: el turno quedó con la salida marcada y sin la acción.
  await expect(page.getByRole("button", { name: "Cerrar turno" })).toHaveCount(0);
  await expect(page.getByText("No puede entrar a marcar la salida.")).toHaveCount(0);
});

test("una cuenta activa no ofrece «Cerrar turno»", async ({ page }) => {
  await setup(page);
  await page.goto("/admin/personas/u-ana");
  await expect(page.getByText("Mozo para cena")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cerrar turno" })).toHaveCount(0);
});

test("si el turno cambió, el diálogo muestra el motivo y la ficha se recarga", async ({ page }) => {
  await setupLeo(page, []);
  let loads = 0;
  page.on("request", (req) => {
    if (req.url().endsWith("/api/v1/admin/users/u-leo")) loads += 1;
  });
  await page.route("**/api/v1/admin/shifts/*/close", (route) =>
    route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({
        detail: "El turno cambió: volvé a abrir la ficha.",
      }),
    })
  );
  await page.goto("/admin/personas/u-leo");
  await page.getByRole("button", { name: "Cerrar turno" }).click();
  await expect.poll(() => loads).toBe(1);
  await page.getByRole("button", { name: "Sí, cerrar turno" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveText(
    "El turno cambió: volvé a abrir la ficha."
  );
  await expect.poll(() => loads).toBe(2);
});
