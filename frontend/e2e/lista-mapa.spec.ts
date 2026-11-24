import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, isoEnDias, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

/**
 * El conmutador «Lista / Mapa» (`components/worker/ListaMapa.tsx`; Julieta,
 * 2026-11-20): Buscar y el Mapa son una sola pestaña de la barra («Buscar») y
 * de una a otra se va con este conmutador, que sólo ve quien trabaja. Son dos
 * pantallas con su dirección y el conmutador navega con `replace`: ir y volver
 * no apila historial. Se mide con la pantalla renderizada.
 */
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const USUARIO = (role: "worker" | "admin") => ({
  id: "u",
  email: `${role}@oido.test`,
  full_name: "Cuenta Demo",
  role,
  status: "activo",
  is_active: true,
  is_verified: true,
});
const turno = (id: string, position: string, company: string) => ({
  id, company_id: `c-${id}`, position, quantity: 1, start_at: isoEnDias(1, "21:00"), end_at: isoEnDias(2, "02:00"), pay_amount: "20000", currency: "ARS",
  tips: true, meal: false, dress_code: null, urgent: false, address: null, city: "Palermo, CABA", latitude: -34.585, longitude: -58.43, title: null, description: null,
  status: "publicado", worker_profile_id: null, created_at: "2026-11-01T12:00:00-03:00", company_name: company, company_logo_url: null, company_verified: false,
});

test.use({ geolocation: { latitude: -34.5895, longitude: -58.4285 }, permissions: ["geolocation"] });

async function preparar(page: Page, role: "worker" | "admin" = "worker") {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  // Catch-all primero: Playwright resuelve la última ruta registrada.
  await page.route("**/api/v1/**", (r) => (r.request().method() === "GET" ? r.fulfill(json([])) : r.continue()));
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json(USUARIO(role))));
  await page.route("**/api/v1/auth/2fa", (r) => r.fulfill(json({ enabled: true, enabled_at: null, recovery_codes_left: 8 })));
  await page.route("**/api/v1/shifts/feed*", (r) =>
    r.fulfill(json([turno("b1", "bartender", "Bar Lavalle"), turno("b2", "mozo", "Café Belgrano")])),
  );
}

const conmutador = (page: Page) => page.getByRole("navigation", { name: "Cómo ver los turnos" });
const barra = (page: Page) => page.getByRole("navigation", { name: "Secciones" });
const arriba = (page: Page) => page.getByRole("navigation", { name: "Principal" });

const VIEWPORTS = [
  { nombre: "celular", ancho: 390, alto: 844 },
  // Con la barra de arriba pero sin el mapa al lado de la lista (debajo de `lg`).
  { nombre: "tablet", ancho: 900, alto: 900 },
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`${vp.nombre} (${vp.ancho} px)`, () => {
    test.use({ viewport: { width: vp.ancho, height: vp.alto } });

    // La pestaña (celular) o el link (compu) de «Buscar» sigue siendo la activa en las dos pantallas.
    const buscarActivo = (page: Page) =>
      (vp.ancho < 768 ? barra(page) : arriba(page)).getByRole("link", { name: "Buscar", exact: true });

    test("desde Buscar, «Mapa» lleva a /map y la pestaña «Buscar» sigue activa; desde /map, «Lista» vuelve", async ({ page }) => {
      await preparar(page);
      await page.goto("/buscar");
      await expect(page.getByRole("heading", { level: 1, name: "Buscar turnos" })).toBeVisible({ timeout: 20_000 });
      await expect(conmutador(page).getByRole("link", { name: "Lista" })).toHaveAttribute("aria-current", "page");
      await expect(conmutador(page).getByRole("link", { name: "Mapa" })).not.toHaveAttribute("aria-current", "page");
      await expect(buscarActivo(page)).toHaveAttribute("aria-current", "page");

      await conmutador(page).getByRole("link", { name: "Mapa" }).click();
      await expect(page).toHaveURL(/\/map$/);
      await expect(conmutador(page).getByRole("link", { name: "Mapa" })).toHaveAttribute("aria-current", "page");
      await expect(conmutador(page).getByRole("link", { name: "Lista" })).not.toHaveAttribute("aria-current", "page");
      await expect(buscarActivo(page)).toHaveAttribute("aria-current", "page");
      // En el mapa no hay otra pestaña ni link «Mapa» para quien trabaja: sólo el del conmutador.
      await expect(page.getByRole("link", { name: "Mapa", exact: true })).toHaveCount(1);

      await conmutador(page).getByRole("link", { name: "Lista" }).click();
      await expect(page).toHaveURL(/\/buscar$/);
      await expect(conmutador(page).getByRole("link", { name: "Lista" })).toHaveAttribute("aria-current", "page");
      await expect(buscarActivo(page)).toHaveAttribute("aria-current", "page");
    });

    test("ir y volver no apila historial: Buscar → Mapa → Lista y «atrás» no vuelve al mapa", async ({ page }) => {
      await preparar(page);
      await page.goto("/feed");
      await expect(page).toHaveURL(/\/feed$/);
      await page.goto("/buscar");
      await expect(conmutador(page)).toBeVisible({ timeout: 20_000 });

      await conmutador(page).getByRole("link", { name: "Mapa" }).click();
      await expect(page).toHaveURL(/\/map$/);
      await conmutador(page).getByRole("link", { name: "Lista" }).click();
      await expect(page).toHaveURL(/\/buscar$/);

      await page.goBack();
      // Una sola entrada de historial para Buscar y Mapa juntos: «atrás» sale de las dos pantallas.
      await expect(page).not.toHaveURL(/\/map$/);
      await expect(page).not.toHaveURL(/\/buscar$/);
    });

    test("el admin en /map conserva su «Mapa» y no ve el conmutador", async ({ page }) => {
      await preparar(page, "admin");
      await page.goto("/map");
      await expect(page).toHaveURL(/\/map$/);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 20_000 });
      await expect(conmutador(page)).toHaveCount(0);
      const nav = vp.ancho < 768 ? barra(page) : arriba(page);
      await expect(nav.getByRole("link", { name: "Mapa", exact: true })).toHaveAttribute("aria-current", "page");
    });
  });
}

test.describe("a 320 px", () => {
  test.use({ viewport: { width: 320, height: 640 } });

  for (const [ruta, titulo] of [
    ["/buscar", "Buscar turnos"],
    ["/map", /turnos? cerca tuyo|Mapa/],
  ] as const) {
    test(`${ruta}: el conmutador entra, no ensancha la página, no se tapa con el título y cada link mide al menos 38 px`, async ({ page }) => {
      await preparar(page);
      await page.goto(ruta);
      const h1 = page.getByRole("heading", { level: 1, name: titulo });
      await expect(h1).toBeVisible({ timeout: 20_000 });
      await expect(conmutador(page)).toBeVisible();

      const caja = (await conmutador(page).boundingBox())!;
      expect(caja.x).toBeGreaterThanOrEqual(0);
      expect(caja.x + caja.width).toBeLessThanOrEqual(320);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

      // No se pisan: ningún renglón del TEXTO del título cruza la caja del conmutador
      // (la caja del h1 puede ser ancha: el texto rodea al conmutador flotante).
      const renglones = await h1.evaluate((el) => {
        const r = document.createRange();
        r.selectNodeContents(el);
        return [...r.getClientRects()].map((c) => ({ x: c.x, y: c.y, w: c.width, h: c.height }));
      });
      expect(renglones.length).toBeGreaterThan(0);
      for (const t of renglones) {
        const seCruzan = caja.x < t.x + t.w && t.x < caja.x + caja.width && caja.y < t.y + t.h && t.y < caja.y + caja.height;
        expect(seCruzan, `texto ${JSON.stringify(t)} vs conmutador ${JSON.stringify(caja)}`).toBe(false);
      }

      for (const nombre of ["Lista", "Mapa"]) {
        const l = (await conmutador(page).getByRole("link", { name: nombre }).boundingBox())!;
        expect(l.height, nombre).toBeGreaterThanOrEqual(38);
        expect(l.x, nombre).toBeGreaterThanOrEqual(0);
        expect(l.x + l.width, nombre).toBeLessThanOrEqual(320);
      }
    });
  }
});

for (const theme of ["light", "dark"] as const) {
  test(`${theme}: el link actual se distingue del otro`, async ({ page }) => {
    await setTheme(page, theme);
    await preparar(page);
    await page.goto("/buscar");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    const [actual, otro] = await Promise.all(
      ["Lista", "Mapa"].map((n) =>
        conmutador(page)
          .getByRole("link", { name: n })
          .evaluate((el) => getComputedStyle(el).backgroundColor + "|" + getComputedStyle(el).color),
      ),
    );
    expect(actual).not.toBe(otro);
  });
}

// En la compu (desde `lg`) Buscar ya muestra el mapa al lado de la lista: no
// lleva el conmutador (Julieta, 2026-11-24). El Mapa sigue existiendo y su
// «Lista» vuelve a Buscar; la pestaña activa es «Buscar» en las dos.
test.describe("compu (1280 px)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("Buscar no lleva el conmutador; el Mapa sí, y su «Lista» vuelve a Buscar", async ({ page }) => {
    await preparar(page);
    await page.goto("/buscar");
    await expect(page.getByRole("heading", { level: 1, name: "Buscar turnos" })).toBeVisible({ timeout: 20_000 });
    await expect(conmutador(page)).toBeHidden();
    await expect(arriba(page).getByRole("link", { name: "Buscar", exact: true })).toHaveAttribute("aria-current", "page");

    await page.goto("/map");
    await expect(conmutador(page)).toBeVisible({ timeout: 20_000 });
    await expect(arriba(page).getByRole("link", { name: "Buscar", exact: true })).toHaveAttribute("aria-current", "page");
    await conmutador(page).getByRole("link", { name: "Lista" }).click();
    await expect(page).toHaveURL(/\/buscar$/);
    await expect(conmutador(page)).toBeHidden();
  });
});
