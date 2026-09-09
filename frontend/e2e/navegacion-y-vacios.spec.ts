import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * Auditoría visual, fases H (navegación) e I (pantallas sin auditar tras el
 * rebrand). Todo lo que se fija acá salió de mirar renders reales a 390px y
 * 1440px, no de leer código:
 *
 * - En `md:` la barra inferior se oculta, así que el header ES el menú — y no
 *   marcaba de ninguna forma en qué sección estabas.
 * - `/support` mostraba DOS botones ámbar para la misma acción cuando la lista
 *   estaba vacía (contra la ley de un solo acento por pantalla, ADR-0011).
 * - `/chats` mostraba dos estados vacíos contradictorios: "Todavía no tenés
 *   conversaciones" a la izquierda y "Elegí una conversación / Seleccioná un
 *   chat de la lista" a la derecha — una instrucción imposible.
 */

const WORKER = {
  id: "user-1",
  email: "mozo@oido.test",
  full_name: "Juana Pérez",
  role: "worker",
  status: "activo",
  is_active: true,
  is_verified: true,
};

async function setup(page: Page) {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(WORKER),
    })
  );
}

test.describe("navegación de escritorio", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("el header marca en qué sección estás, y no sólo con color", async ({ page }) => {
    await setup(page);
    await page.route("**/api/v1/chats", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
    );

    await page.goto("/chats");

    // `aria-current="page"` es la parte que NO puede viajar sólo en el tinte:
    // sin esto, quien usa lector de pantalla no sabe dónde está.
    const activo = page.getByRole("link", { name: "Mensajes" });
    await expect(activo).toHaveAttribute("aria-current", "page", { timeout: 15_000 });

    // Y exactamente uno: si dos links se marcan activos a la vez, la señal no
    // dice nada (pasaría con un `startsWith` mal hecho sobre rutas anidadas).
    await expect(page.locator('header nav a[aria-current="page"]')).toHaveCount(1);
    // `exact`: sin él "Turnos" también matchea "Mis turnos".
    await expect(
      page.getByRole("link", { name: "Turnos", exact: true })
    ).not.toHaveAttribute("aria-current", "page");
  });

  test("las dos barras de navegación se distinguen por nombre", async ({ page }) => {
    await setup(page);
    await page.goto("/feed");

    // Sin `aria-label` un lector anuncia "navegación, navegación" y no hay
    // forma de saber cuál es cuál (hay dos `<nav>` en la misma página).
    await expect(page.getByRole("navigation", { name: "Principal" })).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe("estados vacíos que no se contradicen", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("sin tickets hay UN solo botón para abrir uno", async ({ page }) => {
    await setup(page);
    await page.route("**/api/v1/support/tickets**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
    );

    await page.goto("/support");

    await expect(page.getByRole("button", { name: "Abrir un ticket" })).toBeVisible({
      timeout: 15_000,
    });
    // El "+ Nuevo" del encabezado sobra mientras el estado vacío ya ofrece la
    // misma acción: dos acentos ámbar por lo mismo, en la misma pantalla.
    await expect(page.getByRole("button", { name: "Nuevo" })).toHaveCount(0);
  });

  test("sin conversaciones no se pide elegir una de la lista", async ({ page }) => {
    await setup(page);
    await page.route("**/api/v1/chats", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
    );

    await page.goto("/chats");

    await expect(page.getByText("Todavía no tenés conversaciones")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Elegí una conversación")).toHaveCount(0);
  });
});
