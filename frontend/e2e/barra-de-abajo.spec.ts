import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

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

// Con la dirección «con relieve» (2026-11-19, docs/historial/2026-11-19-barra-de-abajo-relieve.md):
// lisa, sin vidrio ni píldora; lo activo es una raya azul hondo arriba de la
// pestaña. Los nombres de las secciones se leen (4,5) y la raya se distingue
// del fondo (3), en claro y de noche.
for (const theme of ["light", "dark"] as const) {
  test(`${theme}: la activa lleva la raya azul hondo, sin píldora ni vidrio, y todo se lee`, async ({ page }) => {
    await setTheme(page, theme);
    await abrir(page, "worker");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    const barra = page.getByRole("navigation", { name: "Secciones", exact: true });
    await expect(barra.getByRole("link", { name: "Inicio" })).toHaveAttribute("aria-current", "page");

    const m = await barra.evaluate((nav) => {
      const rgb = (s: string) => (s.match(/[\d.]+/g) ?? []).map(Number);
      const lum = ([r, g, b]: number[]) => {
        const c = [r, g, b].map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      };
      const ratio = (a: string, b: string) => {
        const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((p, q) => q - p);
        return (x + 0.05) / (y + 0.05);
      };
      const n = getComputedStyle(nav);
      return {
        fondo: n.backgroundColor,
        desenfoque: n.backdropFilter,
        pestanas: [...nav.querySelectorAll("a")].map((a) => {
          const st = getComputedStyle(a);
          return {
            activa: a.getAttribute("aria-current") === "page",
            raya: st.borderTopWidth,
            rayaContraste: ratio(st.borderTopColor, n.backgroundColor),
            letra: ratio(st.color, n.backgroundColor),
            // La píldora de antes era un fondo detrás del ícono.
            fondos: [...a.querySelectorAll("*")].filter((el) => {
              const bg = getComputedStyle(el).backgroundColor;
              return bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent";
            }).length,
          };
        }),
      };
    });
    // Lisa: fondo opaco y sin desenfoque.
    expect(rgb4(m.fondo)).toBe(1);
    expect(m.desenfoque).toBe("none");
    for (const p of m.pestanas) {
      expect(p.letra).toBeGreaterThanOrEqual(4.5);
      expect(p.fondos).toBe(0);
      expect(p.raya).toBe("3px");
      if (p.activa) expect(p.rayaContraste).toBeGreaterThanOrEqual(3);
    }
  });
}

// Alfa de un color computado (1 si es rgb() sin alfa).
function rgb4(color: string): number {
  const partes = color.match(/[\d.]+/g) ?? [];
  return partes.length === 4 ? Number(partes[3]) : 1;
}
