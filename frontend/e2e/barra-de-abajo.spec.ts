import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * La barra de abajo del celular (`components/BottomNav.tsx`): las pestañas de
 * cada rol tienen que entrar enteras y repartidas en 360 y en 320 px. Con seis
 * pestañas el trabajador veía «Perfil» cortada en el borde derecho: cada
 * pestaña pedía más ancho del que le tocaba. Se mide con la barra renderizada,
 * no con el código (el viewport es lo que decide).
 */

const CUENTAS = {
  worker: { ruta: "/feed", pestanas: 6 },
  employer: { ruta: "/shifts", pestanas: 4 },
  admin: { ruta: "/admin/seguridad", pestanas: 4 },
} as const;

async function abrir(page: Page, role: keyof typeof CUENTAS, extra: object = {}) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await page.route("**/api/v1/**", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
      : route.continue()
  );
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/2fa", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        enabled: !("two_factor_setup_required" in extra),
        enabled_at: null,
        recovery_codes_left: 8,
      }),
    })
  );
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "user-1",
        email: `${role}@oido.test`,
        full_name: "Cuenta de prueba",
        role,
        status: "active",
        is_verified: true,
        ...extra,
      }),
    })
  );
  await page.goto(CUENTAS[role].ruta);
}

for (const ancho of [360, 320]) {
  for (const role of Object.keys(CUENTAS) as Array<keyof typeof CUENTAS>) {
    test(`barra de abajo (${role}) a ${ancho} px: pestañas enteras y repartidas`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: ancho, height: 740 });
      await abrir(page, role);

      const barra = page.getByRole("navigation", { name: "Secciones", exact: true });
      await expect(barra).toBeVisible();
      const pestanas = barra.getByRole("link");
      await expect(pestanas).toHaveCount(CUENTAS[role].pestanas);

      const cajas = await pestanas.evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          // Lo que el texto realmente ocupa: no puede salirse de su pestaña.
          const texto = document.createRange();
          texto.selectNodeContents(el);
          const t = texto.getBoundingClientRect();
          return { x: r.x, right: r.right, width: r.width, height: r.height, tLeft: t.left, tRight: t.right };
        })
      );
      for (const c of cajas) {
        expect(c.x).toBeGreaterThanOrEqual(0);
        expect(c.right).toBeLessThanOrEqual(ancho + 0.5);
        // Área táctil mínima de alto (44 px).
        expect(c.height).toBeGreaterThanOrEqual(44);
        expect(c.tLeft).toBeGreaterThanOrEqual(c.x - 0.5);
        expect(c.tRight).toBeLessThanOrEqual(c.right + 0.5);
      }
      // Repartidas: todas del mismo ancho, y entre todas llenan la barra.
      const anchos = cajas.map((c) => c.width);
      expect(Math.max(...anchos) - Math.min(...anchos)).toBeLessThan(1);
      expect(cajas[cajas.length - 1].right).toBeGreaterThan(ancho - 1);
      // Y la página no se ensancha por la barra.
      const sobra = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(sobra).toBeLessThanOrEqual(0);
    });
  }
}

test("admin con el alta de dos pasos pendiente: se sabe al abrir la sesión y no pide notificaciones", async ({
  page,
}) => {
  const pedidos: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/v1/notifications")) pedidos.push(req.url());
  });
  await abrir(page, "admin", { two_factor_setup_required: true });

  // Sin barra de abajo ni campanita, y ni un pedido de avisos desde la primera
  // carga (no hace falta esperar al primer 403 del panel).
  await expect(page.getByText("Administración")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Secciones", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Notificaciones" })).toHaveCount(0);
  expect(pedidos).toEqual([]);
});
