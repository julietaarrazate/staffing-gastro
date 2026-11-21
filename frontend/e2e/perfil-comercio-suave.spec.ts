import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";
import { deContrato } from "./contrato";

/**
 * El Perfil del comercio con la dirección suave (ADR-0028, 2026-11-21,
 * docs/historial/2026-11-21-perfil-comercio-direccion-suave.md; sin maqueta:
 * con las piezas del Perfil de quien trabaja). «¿Cómo me ven?»: el cielo con
 * el nombre del local, su rubro y su barrio; el logo a caballo de la hoja; la
 * reputación como número grande; la verificación, las cancelaciones tardías y
 * los accesos como filas. Se mide renderizado, en claro y de noche.
 */
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const claim = (status: string) => ({ claim_type: "negocio_verificado", status, confidence: null, decided_at: null, rejection_reason: null });
const CON_HISTORIA = { name: "Bar Lavalle", category: "Bar", city: "Palermo, CABA", rating: 4.7, events_published: 23, on_time_payment_rate: 0.96, payments_recorded: 18, late_cancellations: 1 };

type Opciones = {
  tema?: "light" | "dark";
  perfil?: Record<string, unknown> | null;
  claims?: unknown[];
  rol?: "employer" | "admin";
};

async function perfil(page: Page, o: Opciones = {}) {
  const tema = o.tema ?? "light";
  await setTheme(page, tema);
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  // Catch-all primero: Playwright resuelve la última ruta registrada.
  await page.route("**/api/v1/**", (r) => (r.request().method() === "GET" ? r.fulfill(json([])) : r.continue()));
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) =>
    r.fulfill(json(deContrato(o.rol === "admin" ? "auth_me_admin" : "auth_me_employer", { full_name: "Julieta Demo", email: "julieta@barlavalle.test" })))
  );
  await page.route("**/api/v1/auth/2fa", (r) => r.fulfill(json({ enabled: true, enabled_at: null, recovery_codes_left: 8 })));
  await page.route("**/api/v1/companies/me/profile", (r) =>
    o.perfil === null
      ? r.fulfill({ status: 404, contentType: "application/json", body: '{"detail":"Sin perfil"}' })
      : r.fulfill(json(deContrato("perfil_comercio", o.perfil ?? {})))
  );
  await page.route("**/api/v1/reviews/received", (r) => r.fulfill(json([])));
  await page.route("**/api/v1/identity/me", (r) =>
    r.fulfill(json({ user_id: "u", assurance_level: "L0", identidad_verificada: false, claims: o.claims ?? [] }))
  );
  await page.goto("/profile");
  await expect(page.locator("html")).toHaveAttribute("data-theme", tema);
}

const hoja = (page: Page) => page.locator(".hoja");

for (const tema of ["light", "dark"] as const) {
  test(`${tema}: el cielo lleva el nombre del local, y la hoja la reputación en grande`, async ({ page }) => {
    await perfil(page, { tema, perfil: CON_HISTORIA, claims: [claim("verificada")] });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bar Lavalle");
    await expect(page.locator(".app-cielo")).toContainText("Bar · Palermo, CABA");
    await expect(page.locator(".perfil-numero")).toHaveText(/4,7/);
    await expect(hoja(page)).toContainText("23 turnos publicados · pago a tiempo 96%");
    // El sello, sólo con la constancia aprobada.
    await expect(hoja(page).locator(".chip-suave", { hasText: "Comercio verificado" })).toBeVisible();

    // El título se lee sobre el cielo: su tinta contra el tono del cielo detrás.
    const contraste = await page.getByRole("heading", { level: 1 }).evaluate((el) => {
      const lum = (rgb: number[]) => {
        const [r, g, b] = rgb.map((v) => {
          const c = v / 255;
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const nums = (s: string) => (s.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const cielo = getComputedStyle(el.closest(".app-cielo")!);
      const tinta = lum(nums(getComputedStyle(el).color));
      const fondo = lum(nums(cielo.getPropertyValue("--app-cielo-0") ? colorDe(cielo.getPropertyValue("--app-cielo-0")) : cielo.backgroundColor));
      function colorDe(valor: string) {
        const p = document.createElement("span");
        p.style.color = valor.trim();
        document.body.append(p);
        const c = getComputedStyle(p).color;
        p.remove();
        return c;
      }
      return (Math.max(tinta, fondo) + 0.05) / (Math.min(tinta, fondo) + 0.05);
    });
    expect(contraste).toBeGreaterThanOrEqual(4.5);
  });
}

test("los accesos son filas: Datos del comercio, Mi plan, Favoritos y Ajustes, y el lápiz edita", async ({ page }) => {
  await perfil(page, { perfil: CON_HISTORIA });
  for (const [nombre, destino] of [
    ["Datos del comercio", "/profile/edit"],
    ["Mi plan", "/subscription"],
    ["Trabajadores favoritos", "/favorites"],
    ["Ajustes", "/profile/settings"],
  ]) {
    await expect(hoja(page).getByRole("link", { name: nombre, exact: true })).toHaveAttribute("href", destino);
  }
  await expect(page.locator(".app-cielo").getByRole("link", { name: "Editar perfil" })).toHaveAttribute("href", "/profile/edit");
  // Quién está a cargo: el nombre de la cuenta (se edita ahí) y su mail.
  await expect(hoja(page)).toContainText("A cargo");
  await expect(hoja(page)).toContainText("Julieta Demo");
  await expect(hoja(page)).toContainText("julieta@barlavalle.test");
  await expect(hoja(page).getByRole("button", { name: "Editar nombre" })).toBeVisible();
});

test("al editar el nombre «A cargo», el campo no queda escondido detrás de la barra de abajo", async ({ page }) => {
  await perfil(page, { perfil: CON_HISTORIA });
  await hoja(page).getByRole("button", { name: "Editar nombre" }).click();
  const campo = hoja(page).getByRole("textbox");
  await expect(campo).toBeFocused();
  const barra = page.getByRole("navigation", { name: "Secciones" });
  await expect
    .poll(async () => (await barra.boundingBox())!.y - ((await campo.boundingBox())!.y + (await campo.boundingBox())!.height))
    .toBeGreaterThanOrEqual(0);
});

test("la verificación va arriba mientras falta (también pendiente), y baja al final de su columna cuando ya está aprobada", async ({ page }) => {
  const tarjeta = () => hoja(page).getByText("Verificación del comercio");
  const tardias = () => page.getByRole("region", { name: "Cancelaciones tardías" });
  const sello = () => hoja(page).locator(".chip-suave", { hasText: "Comercio verificado" });

  for (const claims of [[], [claim("pendiente")]]) {
    await perfil(page, { perfil: CON_HISTORIA, claims });
    await expect(tarjeta()).toBeVisible();
    await expect(tardias()).toBeVisible();
    await expect(sello()).toHaveCount(0);
    expect((await tarjeta().boundingBox())!.y).toBeLessThan((await tardias().boundingBox())!.y);
  }

  // Aprobada: una sola tarjeta, y un solo pedido del estado.
  let pedidos = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/identity/me")) pedidos += 1;
  });
  await perfil(page, { perfil: CON_HISTORIA, claims: [claim("verificada")] });
  await expect(sello()).toBeVisible();
  await expect(tarjeta()).toHaveCount(1);
  await expect.poll(async () => (await tarjeta().boundingBox())!.y - (await tardias().boundingBox())!.y).toBeGreaterThan(0);
  expect(pedidos).toBe(1);
});

test("mientras carga, el cielo no muestra el nombre de la cuenta para cambiarlo después", async ({ page }) => {
  let soltar!: () => void;
  const espera = new Promise<void>((r) => (soltar = r));
  await setTheme(page, "light");
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await page.route("**/api/v1/**", (r) => (r.request().method() === "GET" ? r.fulfill(json([])) : r.continue()));
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/companies/me/profile", async (r) => {
    await espera;
    await r.fulfill(json(deContrato("perfil_comercio", CON_HISTORIA)));
  });
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json(deContrato("auth_me_employer", { full_name: "Julieta Demo" }))));
  await page.route("**/api/v1/reviews/received", (r) => r.fulfill(json([])));
  await page.route("**/api/v1/identity/me", (r) => r.fulfill(json({ claims: [] })));
  await page.goto("/profile");
  const cielo = page.locator(".app-cielo");
  await expect(cielo).toBeVisible();
  await expect(cielo).not.toContainText("Julieta Demo");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Perfil");
  // Tampoco la inicial de la cuenta en el círculo.
  await expect(page.locator(".perfil-foto")).toHaveText("");
  soltar();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bar Lavalle");
});

test("si el perfil no se pudo cargar (no es un 404), lo dice y los accesos siguen", async ({ page }) => {
  await perfil(page, { perfil: CON_HISTORIA });
  await page.route("**/api/v1/companies/me/profile", (r) => r.fulfill({ status: 500, contentType: "application/json", body: '{"detail":"x"}' }));
  await page.reload();
  await expect(hoja(page).getByRole("alert")).toBeVisible();
  await expect(hoja(page).getByRole("link", { name: "Datos del comercio", exact: true })).toBeVisible();
  await expect(page.locator(".perfil-numero")).toHaveCount(0);
});

test("un logo que no carga vuelve a la inicial", async ({ page }) => {
  await page.route("**/logo-roto.png", (r) => r.fulfill({ status: 404, body: "" }));
  await perfil(page, { perfil: { ...CON_HISTORIA, logo_url: "/logo-roto.png" } });
  await expect(page.locator(".perfil-foto")).toHaveText("B");
  await expect(page.locator(".perfil-foto img:not(.portada-nube)")).toHaveCount(0);
  await expect(page.locator(".perfil-foto [data-sin-foto]")).toBeVisible();
});

test("un comercio nuevo no ve ceros: la reputación arranca con su primer turno", async ({ page }) => {
  await perfil(page, { perfil: { name: "Bar Palermo" } });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bar Palermo");
  await expect(hoja(page)).toContainText("Tu reputación arranca con tu primer turno.");
  await expect(page.locator(".perfil-numero")).toHaveCount(0);
  await expect(page.getByText(/cancelaci(ón|ones) tardía/i)).toHaveCount(0);
});

test("con turnos publicados y sin nota, el número grande son los turnos (sin nota no es cero)", async ({ page }) => {
  await perfil(page, { perfil: { name: "Bar Palermo", rating: 0, events_published: 3 } });
  await expect(page.locator(".perfil-numero")).toHaveText("3");
  await expect(hoja(page)).toContainText("turnos publicados");
  // Sin pagos registrados no hay «pago a tiempo 0%».
  await expect(hoja(page)).not.toContainText("pago a tiempo");
});

test("sin perfil de comercio todavía: el nombre de la cuenta y los accesos, sin error", async ({ page }) => {
  await perfil(page, { perfil: null });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Julieta Demo");
  await expect(hoja(page).getByRole("link", { name: "Datos del comercio", exact: true })).toBeVisible();
  // Sin cartel de error en la hoja (el anunciador de rutas de Next también es un `alert`).
  await expect(hoja(page).getByRole("alert")).toHaveCount(0);
  await expect(hoja(page)).not.toContainText("No se pudo cargar");
  await expect(page.locator(".perfil-numero")).toHaveCount(0);
});

test("a 320 px, con un nombre largo, nada corre la página", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await perfil(page, { perfil: { ...CON_HISTORIA, name: "Parrilla y Vermutería Don Julián de Villa Crespo", category: "Parrilla y restaurante" } });
  await expect(page.locator(".perfil-numero")).toBeVisible();
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sobra).toBeLessThanOrEqual(0);
  // El lápiz sigue entero a la derecha del título.
  const lapiz = await page.locator(".app-cielo").getByRole("link", { name: "Editar perfil" }).boundingBox();
  expect(lapiz!.x + lapiz!.width).toBeLessThanOrEqual(320);
  expect(lapiz!.width).toBeGreaterThanOrEqual(44);
});

test("un solo ámbar: en el perfil del comercio ninguna acción lleva el acento", async ({ page }) => {
  await perfil(page, { perfil: CON_HISTORIA, claims: [] });
  await expect(hoja(page).getByText("Verificación del comercio")).toBeVisible();
  const ambar = await page.locator("main a, main button").evaluateAll(
    (els) => els.filter((el) => getComputedStyle(el).backgroundImage.includes("rgb(246, 169, 42)") && !(el as HTMLButtonElement).disabled).length
  );
  expect(ambar).toBeLessThanOrEqual(1);
});

test("el admin conserva su vista de antes (migra con Administración)", async ({ page }) => {
  await perfil(page, { rol: "admin" });
  await expect(page.getByRole("heading", { level: 1, name: "Perfil" })).toBeVisible();
  await expect(page.locator(".estilo-suave")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Ajustes" })).toBeVisible();
});
