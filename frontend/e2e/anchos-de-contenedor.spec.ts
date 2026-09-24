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

/**
 * Pantallas de detalle (auditoría visual 2026-09-24, fase L). El test de
 * arriba sólo mira que nada se escape del marco, y un detalle angosto lo pasa
 * igual: `/companies/[id]` medía 576px a 768 y 896 a 1440, con otra
 * alineación que el header y que la lista de la que venías. Acá la regla es
 * más estricta: el contenedor de un detalle mide **exactamente** uno de los
 * dos anchos del sistema (`--app-frame` o `--app-reading`), nunca uno escrito
 * a mano.
 */
const COMPANY = {
  id: "c1",
  user_id: "u-c1",
  name: "Parrilla y Vermutería Don Julián",
  logo_url: null,
  cover_photo_url: null,
  category: "parrilla",
  description: "Parrilla de barrio.",
  address: "Honduras 5000",
  city: "Palermo",
  latitude: -34.58,
  longitude: -58.43,
  capacity: 60,
  opening_hours: null,
  rating: 4.6,
  events_published: 12,
  on_time_payment_rate: 1,
  late_cancellations: 0,
};

const WORKER = {
  id: "w1",
  user_id: "u-w1",
  full_name: "Juana Pérez",
  photo_url: null,
  birth_date: null,
  age: 27,
  city: "Palermo",
  bio: "Bartender.",
  latitude: null,
  longitude: null,
  skills: [],
  years_experience: 3,
  languages: [],
  certifications: [],
  cv_url: null,
  cv_filename: null,
  is_available: true,
  rating: 4.8,
  events_completed: 10,
  punctuality_rate: 1,
  cancellations: 0,
  no_shows: 0,
  badges: [],
  level: "bronce",
  identidad_verificada: true,
};

const TICKET = {
  id: "t1",
  user_id: "u-w",
  category: "general",
  subject: "No me llega el mail",
  status: "abierto",
  created_at: "2026-09-20T12:00:00Z",
  updated_at: "2026-09-20T12:00:00Z",
  messages: [
    {
      id: "m1",
      ticket_id: "t1",
      sender_user_id: "u-w",
      body: "Hola, no me llega el mail de confirmación.",
      created_at: "2026-09-20T12:00:00Z",
    },
  ],
};

const DETALLES: Array<{
  role: keyof typeof SESSIONS;
  ruta: string;
  api: string;
  body: unknown;
  ancho: "--app-frame" | "--app-reading";
}> = [
  { role: "worker", ruta: "/companies/c1", api: "**/api/v1/companies/c1", body: COMPANY, ancho: "--app-frame" },
  { role: "employer", ruta: "/workers/w1", api: "**/api/v1/workers/w1", body: WORKER, ancho: "--app-frame" },
  { role: "worker", ruta: "/support/t1", api: "**/api/v1/support/tickets/t1", body: TICKET, ancho: "--app-reading" },
];

test.describe("las pantallas de detalle usan los anchos del sistema", () => {
  for (const viewport of [
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    for (const d of DETALLES) {
      test(`${d.ruta} mide ${d.ancho} a ${viewport.width}px`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await setup(page, d.role);
        await page.route(d.api, (route) =>
          route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(d.body),
          })
        );
        await page.goto(d.ruta);
        // El `h1` sólo existe cuando la pantalla cargó de verdad: el esqueleto
        // y el estado de error no lo tienen, y medir sobre ellos no dice nada.
        await page.locator("main h1").first().waitFor({ timeout: 15_000 });

        const medida = await page.evaluate((token) => {
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
          const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
          const esperado =
            parseFloat(getComputedStyle(document.documentElement).getPropertyValue(token)) * rem;
          return {
            esperado,
            maxWidth: contenedor ? parseFloat(getComputedStyle(contenedor).maxWidth) : null,
          };
        }, d.ancho);

        expect(medida.maxWidth, `no se encontró el contenedor de ${d.ruta}`).not.toBeNull();
        expect(medida.maxWidth).toBe(medida.esperado);
      });
    }
  }
});
