import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

/**
 * El acceso y la bienvenida con la dirección suave (ADR-0028, 2026-11-21,
 * docs/historial/2026-11-21-acceso-direccion-suave.md): el cielo con el «oído»
 * y el título en letra normal, la hoja con el formulario, un solo ámbar, sin
 * relieve. La lógica, los textos y el consentimiento legal no cambian.
 */
const json = (body: unknown, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const ambares = (page: Page) =>
  page.locator("button:visible, a:visible").evaluateAll(
    (els) =>
      els.filter(
        (el) =>
          /rgb\(246, 169, 42\)/.test(getComputedStyle(el).backgroundImage) ||
          getComputedStyle(el).backgroundColor === "rgb(217, 119, 6)",
      ).length,
  );

async function sinSesion(page: Page, theme: "light" | "dark", ruta: string) {
  await setTheme(page, theme);
  await skipSplash(page);
  await blockExternalHosts(page);
  await page.route("**/api/v1/**", (r) => r.fulfill(json({ detail: "no" }, 404)));
  await page.route("**/api/v1/auth/guest", (r) => r.fulfill(json({ enabled: false })));
  await page.goto(ruta);
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

async function cieloYHoja(page: Page, titulo: string | RegExp) {
  const h1 = page.getByRole("heading", { level: 1, name: titulo });
  await expect(h1).toHaveClass(/titulo-pantalla/);
  await expect(h1.locator("xpath=..")).toHaveClass(/app-cielo/);
  await expect(page.locator(".estilo-suave .hoja")).toBeVisible();
  // El «oído» plano del cielo (el del Inicio), sin el fileteado ni la brocha.
  await expect(page.locator(".app-cielo").getByRole("link", { name: "Inicio" })).toBeVisible();
  await expect(page.locator(".app-cielo svg")).toHaveCount(0);
  // Sin relieve, sin filete de antes, sin letra serif ni brocha.
  await expect(page.locator(".tarjeta-relieve, .letra-cartel")).toHaveCount(0);
  await expect(h1).not.toHaveCSS("font-family", /Young Serif/);
  // Sin encabezado de visitante: el «oído» del cielo lo reemplaza.
  await expect(page.locator("header")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

for (const theme of ["light", "dark"] as const) {
  test(`${theme}: /login va sobre el cielo y la hoja, con un solo ámbar`, async ({ page }) => {
    await sinSesion(page, theme, "/login?next=/turno/abc");
    await cieloYHoja(page, "Ingresar");
    await expect(page.getByLabel("Email")).toHaveClass(/campo/);
    await expect(page.getByRole("button", { name: "Ingresar" })).toHaveCSS("background-image", /rgb\(246, 169, 42\)/);
    expect(await ambares(page)).toBe(1);
    await expect(page.getByRole("link", { name: "¿Olvidaste tu contraseña?" })).toHaveAttribute("href", "/recuperar");
    await expect(page.getByRole("link", { name: "Creá una" })).toHaveAttribute("href", /\/register\?next=/);
    // La zona segura de arriba se pinta con el cielo, como en las demás.
    expect(await page.evaluate(() => document.documentElement.dataset.cromo)).toBe("app");
  });

  test(`${theme}: /register tiene el rol en teclas, un solo ámbar y el consentimiento obligatorio`, async ({ page }) => {
    await sinSesion(page, theme, "/register?rol=comercio");
    await cieloYHoja(page, "Crear cuenta");
    const comercio = page.getByRole("button", { name: "Soy comercio" });
    const trabajador = page.getByRole("button", { name: "Soy trabajador/a" });
    await expect(comercio).toHaveAttribute("aria-pressed", "true");
    await expect(comercio).toHaveClass(/tecla/);
    await expect(comercio).toHaveCSS("background-image", /rgb\(42, 115, 163\)/);
    await expect(trabajador).toHaveAttribute("aria-pressed", "false");
    await trabajador.click();
    await expect(trabajador).toHaveAttribute("aria-pressed", "true");
    // El texto legal y sus links, idénticos a los de antes.
    const casilla = page.getByRole("checkbox", { name: "Acepto los Términos y Condiciones y la Política de Privacidad" });
    await expect(casilla).toHaveClass(/casilla-nativa/);
    await expect(casilla).not.toBeChecked();
    await expect(page.getByRole("link", { name: "Términos y Condiciones" })).toHaveAttribute("href", "/terminos");
    await expect(page.getByRole("link", { name: "Política de Privacidad" })).toHaveAttribute("href", "/privacidad");
    // «Crear cuenta» arranca desactivado (gris): ámbar no hay; con todo listo, uno.
    expect(await ambares(page)).toBe(0);
    // Con todo lleno menos la casilla, no se puede crear la cuenta.
    await page.getByLabel("Nombre completo").fill("Ana Mozo");
    await page.getByLabel("Fecha de nacimiento").fill("1995-05-10");
    await page.getByLabel("Email").fill("ana@mail.com");
    await page.getByPlaceholder("Contraseña (mín. 8 caracteres)").fill("unaClaveLarga1");
    await expect(page.getByRole("button", { name: "Crear cuenta" })).toBeDisabled();
    await expect(page.getByTestId("motivo-crear-cuenta")).toBeVisible();
    await casilla.check();
    await expect(casilla).toBeChecked();
    await expect(casilla).toHaveCSS("background-image", /rgb\(42, 115, 163\)/);
    await expect(page.getByRole("button", { name: "Crear cuenta" })).toBeEnabled();
    expect(await ambares(page)).toBe(1);
  });
}

test("recuperar, restablecer y verificar-email van sobre el cielo y la hoja", async ({ page }) => {
  await sinSesion(page, "light", "/recuperar");
  await cieloYHoja(page, "Recuperar contraseña");
  expect(await ambares(page)).toBe(1);
  await page.goto("/restablecer?token=abc");
  await cieloYHoja(page, "Elegí una nueva contraseña");
  await expect(page.getByLabel("Nueva contraseña", { exact: true })).toHaveClass(/campo/);
  await page.goto("/verificar-email");
  await cieloYHoja(page, "Confirmá tu email");
});

test("a 320 px y con el teclado a 500 px de alto el botón principal se alcanza", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 500 });
  await sinSesion(page, "light", "/register");
  const boton = page.getByRole("button", { name: "Crear cuenta" });
  await boton.scrollIntoViewIfNeeded();
  await expect(boton).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

for (const rol of ["employer", "worker"] as const) {
  test(`la bienvenida de ${rol}: el cielo con los pasos tachados y la hoja con el paso`, async ({ page }) => {
    await setTheme(page, "light");
    await skipSplash(page);
    await injectSession(page);
    await blockExternalHosts(page);
    await page.route("**/api/v1/**", (r) => (r.request().method() === "GET" ? r.fulfill(json([])) : r.continue()));
    await mockEmptyNotifications(page);
    await page.route("**/api/v1/auth/me", (r) =>
      r.fulfill(json({ id: "u", email: "n@oido.test", full_name: "Nuevo", role: rol, status: "activo", is_active: true, is_verified: true })),
    );
    await page.route("**/api/v1/companies/me/profile", (r) => r.fulfill(json({ detail: "no" }, 404)));
    await page.route("**/api/v1/workers/me/profile", (r) => r.fulfill(json({ detail: "no" }, 404)));
    await page.goto(rol === "employer" ? "/bienvenida" : "/bienvenida?paso=zona");
    await cieloYHoja(page, rol === "employer" ? /Cómo se llama tu comercio/ : /Dónde querés trabajar/);
    const pasos = page.locator(".app-cielo").getByRole("list", { name: /^Paso 1 de/ });
    await expect(pasos).toBeVisible();
    if (rol === "employer") {
      await page.getByRole("textbox", { name: "Nombre del comercio" }).fill("Bar Lavalle");
      expect(await ambares(page)).toBe(1);
      await page.getByRole("button", { name: "Continuar" }).click();
      const paso2 = page.getByRole("list", { name: "Paso 2 de 2: Ubicación" });
      await expect(paso2.locator("li").first().locator("svg.tacha")).toHaveCount(1);
    } else {
      // «Continuar» está desactivado hasta elegir la zona: ningún ámbar todavía.
      expect(await ambares(page)).toBe(0);
    }
  });
}
