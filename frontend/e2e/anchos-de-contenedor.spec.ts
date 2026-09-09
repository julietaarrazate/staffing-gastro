import { test, expect, type Page } from "@playwright/test";
import {
  blockExternalHosts,
  injectSession,
  mockEmptyNotifications,
  skipSplash,
} from "./mocks";

/**
 * Anchos de contenedor (auditoría visual, fase K — ver
 * docs/design/DESIGN_TOKENS.md §3.bis).
 *
 * Lo que fija este test es la regla, no un número por pantalla: **el header es
 * el marco y ninguna pantalla lo excede.** Antes no había regla y cada
 * pantalla eligió a mano — medido a 1440px, el contenido arrancaba en cuatro
 * columnas distintas y cuatro pantallas eran más anchas que el propio header,
 * así que el contenido se escapaba del marco.
 *
 * El test existe porque el arreglo por sí solo no evita la recaída: con seis
 * pantallas eligiendo a mano, la séptima vuelve a elegir mal. Acá se entera.
 */

const SESSIONS = {
  worker: {
    id: "u-w",
    email: "w@oido.test",
    full_name: "Juana Pérez",
    role: "worker",
    status: "activo",
    is_active: true,
    is_verified: true,
  },
  employer: {
    id: "u-e",
    email: "e@oido.test",
    full_name: "Bar La Esquina",
    role: "employer",
    status: "activo",
    is_active: true,
    is_verified: true,
  },
} as const;

const RUTAS: Array<[keyof typeof SESSIONS, string]> = [
  ["worker", "/feed"],
  ["worker", "/buscar"],
  ["worker", "/my-shifts"],
  ["worker", "/chats"],
  ["worker", "/support"],
  ["employer", "/shifts"],
  ["employer", "/favorites"],
];

async function setup(page: Page, role: keyof typeof SESSIONS) {
  await injectSession(page);
  // La splash de marca tapa la pantalla entera ~1.1s y no tiene contenedor de
  // página: sin esto la medición cae sobre ella, no sobre la pantalla real.
  await skipSplash(page);
  await blockExternalHosts(page);
  // Colección vacía para TODO lo que no se mockea explícitamente: acá no
  // importa el contenido de cada pantalla, importa el ancho de su contenedor,
  // y sin esto las que fallan al pedir datos caen en un estado de error que no
  // tiene el contenedor de página.
  //
  // OJO CON EL ORDEN: Playwright resuelve las rutas al revés (gana la última
  // registrada), así que este catch-all va PRIMERO y las específicas después.
  // Al revés pisa a `/auth/me` y la sesión sale con el rol equivocado.
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
      body: JSON.stringify(SESSIONS[role]),
    })
  );
}

test.describe("ninguna pantalla se escapa del marco del header", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const [role, ruta] of RUTAS) {
    test(`${ruta} no excede el ancho del header`, async ({ page }) => {
      await setup(page, role);
      await page.goto(ruta);
      // Medir apenas carga da falsos negativos: algunas pantallas montan
      // primero un esqueleto cuyo contenedor todavía no es el definitivo.
      // Se espera a que el `<main>` tenga su contenedor acotado antes de medir.
      await page
        .locator("main .app-container, main [class*='max-w-']")
        .first()
        .waitFor({ state: "attached", timeout: 15_000 });

      // Se compara contra el header REAL, no contra 1024 escrito a mano: si
      // mañana el marco cambia, el test sigue diciendo la verdad en vez de
      // fijar un número que quedó viejo.
      const anchos = await page.evaluate(() => {
        const header = document.querySelector("header > div");
        const main = document.querySelector("main");
        let contenedor: Element | null = null;
        const walk = (el: Element | null, depth: number) => {
          if (!el || depth > 4 || contenedor) return;
          const cs = getComputedStyle(el);
          if (cs.maxWidth !== "none" && parseFloat(cs.maxWidth) > 200) {
            contenedor = el;
            return;
          }
          for (const c of Array.from(el.children)) walk(c, depth + 1);
        };
        walk(main, 0);
        return {
          marco: header ? Math.round(header.getBoundingClientRect().width) : null,
          contenido: contenedor
            ? Math.round((contenedor as Element).getBoundingClientRect().width)
            : null,
        };
      });

      expect(anchos.marco, "no se encontró el contenedor del header").not.toBeNull();
      expect(
        anchos.contenido,
        `no se encontró el contenedor de página en ${ruta}`
      ).not.toBeNull();
      expect(anchos.contenido!).toBeLessThanOrEqual(anchos.marco!);
    });
  }
});
