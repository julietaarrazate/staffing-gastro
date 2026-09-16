import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * Paso "¿Cuándo?" de publicar un turno (2026-09-16).
 *
 * Dos cosas que Julieta reportó probando la app real, y que ningún test veía:
 *
 *  1. **"En el modo oscuro cuando ponés la hora no se ve."** Los dos
 *     `<input type="datetime-local">` no declaraban color de texto, así que
 *     heredaban la tinta del lienzo —oscura en los DOS temas— y adentro de una
 *     tarjeta oscura quedaban texto oscuro sobre fondo oscuro.
 *  2. **"Debería salir un calendario, así te asegurás bien el día."** El
 *     selector nativo ya se abre al tocar el campo; lo que faltaba era la
 *     confirmación. El campo vuelve mostrando `19/09/2026` —o `09/19/2026`,
 *     según el locale del dispositivo, que es justamente la ambigüedad— y
 *     nadie hace la cuenta mental de qué día de la semana es eso.
 *
 * El primer test mide **contraste real computado**, no clases: si mañana
 * alguien cambia el token o saca la clase, falla igual. La lección viene de
 * los tres bugs de contraste de septiembre, que pasaron `tsc`, `build`,
 * Vitest y Playwright en verde porque nadie medía lo que se ve.
 */

const EMPLOYER = {
  id: "user-1",
  email: "comercio@oido.test",
  full_name: "Bar La Esquina",
  role: "employer",
  status: "activo",
  is_active: true,
  is_verified: true,
};

async function irAlPasoCuando(page: Page, tema: "light" | "dark") {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await page.route("**/api/v1/**", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
      : route.continue()
  );
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(EMPLOYER),
    })
  );
  await page.goto("/shifts/new");
  await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), tema);

  // Mismo camino que employer-wizard.spec.ts: puesto → cantidad → horario.
  await page.getByRole("button", { name: "Mozo/a" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("¿Cuándo?")).toBeVisible();
}

/** Contraste WCAG entre dos colores `rgb(...)` ya computados. */
function contraste(a: string, b: string): number {
  const luz = (css: string) => {
    const [r, g, bl] = css.match(/\d+/g)!.slice(0, 3).map(Number);
    const c = [r, g, bl].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const [l1, l2] = [luz(a), luz(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

for (const tema of ["light", "dark"] as const) {
  test(`la fecha elegida se lee en tema ${tema}`, async ({ page }) => {
    await irAlPasoCuando(page, tema);

    const campos = page.locator('input[type="datetime-local"]');
    await campos.nth(0).fill("2026-09-19T21:00");
    await campos.nth(1).fill("2026-09-20T04:00");

    for (let i = 0; i < 2; i++) {
      const medida = await campos.nth(i).evaluate((el) => {
        const cs = getComputedStyle(el as HTMLElement);
        return { color: cs.color, fondo: cs.backgroundColor };
      });
      // 4.5:1 es el mínimo AA para texto normal. El bug daba ~1:1.
      expect(
        contraste(medida.color, medida.fondo),
        `${tema}: texto ${medida.color} sobre ${medida.fondo}`
      ).toBeGreaterThan(4.5);
    }
  });
}

test("cada campo confirma el día en palabras, no sólo en números", async ({ page }) => {
  await irAlPasoCuando(page, "light");

  const campos = page.locator('input[type="datetime-local"]');
  await campos.nth(0).fill("2026-09-19T21:00");
  await campos.nth(1).fill("2026-09-20T04:00");

  // El 19/09/2026 es sábado y el 20 domingo: el nombre del día es el dato que
  // evita el error, porque nadie piensa "el 19" — piensa "el sábado".
  await expect(page.getByText(/sábado.*19 de septiembre/i)).toBeVisible();
  await expect(page.getByText(/domingo.*20 de septiembre/i)).toBeVisible();

  // Y la duración derivada, que no está en ningún otro lado.
  await expect(page.getByText("Jornada de 7 h")).toBeVisible();
});

test("sin fecha elegida no se inventa ningún día", async ({ page }) => {
  await irAlPasoCuando(page, "light");
  // Con los campos vacíos no puede aparecer un "Invalid Date" ni un día suelto.
  await expect(page.getByText(/invalid/i)).toHaveCount(0);
  await expect(page.getByText(/Jornada de/)).toHaveCount(0);
});

/**
 * El mismo defecto (input sin color de texto) vivía también en el wizard de
 * evento (`/shifts/new-event`, un solo paso, sin el flujo de 3 pantallas de
 * `/shifts/new`). Se corrige y se confirma acá con el mismo método: contraste
 * computado, no clases.
 */
test("evento: la fecha también se lee en oscuro y confirma el día", async ({ page }) => {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await page.route("**/api/v1/**", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
      : route.continue()
  );
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(EMPLOYER),
    })
  );
  await page.goto("/shifts/new-event");
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));

  const campos = page.locator('input[type="datetime-local"]');
  await campos.nth(0).fill("2026-09-19T21:00");
  await campos.nth(1).fill("2026-09-20T04:00");

  const medida = await campos.nth(0).evaluate((el) => {
    const cs = getComputedStyle(el as HTMLElement);
    return { color: cs.color, fondo: cs.backgroundColor };
  });
  expect(
    contraste(medida.color, medida.fondo),
    `dark (evento): texto ${medida.color} sobre ${medida.fondo}`
  ).toBeGreaterThan(4.5);

  await expect(page.getByText(/sábado.*19 de septiembre/i)).toBeVisible();
  await expect(page.getByText(/domingo.*20 de septiembre/i)).toBeVisible();
});
