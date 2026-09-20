import { test, expect } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * Fila de acciones rápidas del panel del comercio (2026-09-16).
 *
 * Lo que fija este spec no es el diseño sino las dos reglas que lo hacen
 * funcionar, y que son fáciles de romper sin darse cuenta al agregar la
 * próxima acción:
 *
 *  1. **Una sola acción con acento** (ADR-0011, un acento por pantalla). Si
 *     mañana alguien marca dos como `primary`, la fila deja de decir cuál es
 *     LA acción y vuelve a ser lo que era: un montón de botones parejos.
 *  2. **Ningún destino que ya esté en el nav de abajo.** Repetir un destino
 *     que está a un toque no es una acción rápida, es ruido — y es el error
 *     más probable al sumar la siguiente (`/search` es el candidato obvio y
 *     justamente el que no va).
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

test.describe("acciones rápidas del panel", () => {
  test.beforeEach(async ({ page }) => {
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
    await page.goto("/shifts");
  });

  test("hay cuatro acciones y 'Publicar' lleva al alta de turno", async ({ page }) => {
    const fila = page.getByRole("navigation", { name: "Acciones rápidas" });
    await expect(fila).toBeVisible();
    await expect(fila.getByRole("link")).toHaveCount(4);

    await fila.getByRole("link", { name: "Publicar" }).click();
    await expect(page).toHaveURL(/\/shifts\/new$/);
  });

  test("una sola acción lleva el acento de marca", async ({ page }) => {
    const fila = page.getByRole("navigation", { name: "Acciones rápidas" });
    // El acento se mide por el color REAL del chip, no por la clase: así el
    // test sigue valiendo si mañana el token cambia de nombre.
    const conAcento = await fila.evaluate((nav) => {
      const primario = getComputedStyle(document.documentElement)
        .getPropertyValue("--color-primary")
        .trim();
      const aRgb = (hex: string) => {
        const n = parseInt(hex.replace("#", ""), 16);
        return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
      };
      const objetivo = aRgb(primario);
      return [...nav.querySelectorAll("span")].filter(
        (el) => getComputedStyle(el).backgroundColor === objetivo
      ).length;
    });
    expect(conAcento).toBe(1);
  });

  test("ninguna acción repite un destino del nav de abajo", async ({ page }) => {
    const fila = page.getByRole("navigation", { name: "Acciones rápidas" });
    const nav = page.getByRole("navigation", { name: "Secciones" });

    // `evaluateAll` NO espera: si el nav todavía no se renderizó devuelve `[]`
    // y el test falla con "Received length: 0" sin decir por qué. Pasó en CI el
    // 2026-09-16 (2 workers compartiendo CPU) mientras en local siempre ganaba
    // la carrera. Los `expect` de abajo sí reintentan, así que son los que
    // esperan a que el DOM esté listo; recién después se leen los href.
    await expect(fila.getByRole("link")).toHaveCount(4);
    await expect(nav.getByRole("link").first()).toBeVisible();

    const href = (loc: ReturnType<typeof page.getByRole>) =>
      loc.evaluateAll((els) => els.map((el) => new URL((el as HTMLAnchorElement).href).pathname));

    const rapidas = await href(fila.getByRole("link"));
    const abajo = await href(nav.getByRole("link"));

    expect(rapidas).toHaveLength(4);
    expect(abajo.length).toBeGreaterThan(0);
    expect(rapidas.filter((ruta) => abajo.includes(ruta))).toEqual([]);
  });
});
