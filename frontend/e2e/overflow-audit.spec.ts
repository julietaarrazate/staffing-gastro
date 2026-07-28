import { test, expect, type Page } from "@playwright/test";
import {
  injectSession,
  blockExternalHosts,
  skipSplash,
  mockEmptyNotifications,
} from "./mocks";

/**
 * Auditoría de encuadre en mobile (390px). Recorre las pantallas con datos
 * realistas (incluidos nombres/textos largos, que son los que rompen un
 * layout) y reporta cualquier elemento que se salga del ancho del viewport.
 *
 * Ignora los contenedores que scrollean horizontal a propósito (el tab bar
 * del panel) y sus hijos: ahí el desborde es el diseño, no un bug.
 */

const LONG_COMPANY = "Restaurante Parrilla La Estancia de Don Alberto Palermo Soho";
const LONG_CITY = "Palermo Soho, Ciudad Autónoma de Buenos Aires, Argentina";

function shift(overrides: Record<string, unknown> = {}) {
  return {
    id: "shift-1",
    company_id: "company-1",
    position: "encargado_de_salon",
    quantity: 1,
    start_at: "2026-08-10T20:00:00-03:00",
    end_at: "2026-08-10T23:00:00-03:00",
    pay_amount: "1250000",
    currency: "ARS",
    tips: true,
    dress_code: "Camisa blanca, pantalón negro de vestir y zapatos cerrados",
    urgent: true,
    address: "Avenida Raúl Scalabrini Ortiz 1234, piso 2 depto B",
    city: LONG_CITY,
    latitude: -34.5875,
    longitude: -58.4257,
    title: null,
    description: "Turno de cena en salón principal para evento corporativo grande.",
    status: "publicado",
    worker_profile_id: null,
    check_in_latitude: null,
    check_in_longitude: null,
    check_in_at: null,
    check_out_latitude: null,
    check_out_longitude: null,
    check_out_at: null,
    paid_at: null,
    created_at: "2026-07-01T12:00:00-03:00",
    company_name: LONG_COMPANY,
    company_logo_url: null,
    ...overrides,
  };
}

const WORKER_PROFILE = {
  id: "profile-1",
  user_id: "user-1",
  full_name: "María Fernanda Gutiérrez de la Torre",
  photo_url: null,
  birth_date: "1995-05-05",
  age: 31,
  city: LONG_CITY,
  bio: "Diez años de experiencia en salón y barra.",
  latitude: -34.5875,
  longitude: -58.4257,
  skills: ["mozo", "bartender", "encargado_de_salon", "runner"],
  years_experience: 10,
  languages: ["español", "inglés", "portugués"],
  certifications: ["Manipulación de alimentos"],
  cv_url: null,
  is_available: true,
  rating: "4.85",
  events_completed: 128,
  punctuality_rate: "0.97",
  cancellations: 1,
  no_shows: 0,
  badges: ["puntual", "experimentado", "recomendado"],
  level: "oro",
  created_at: "2026-01-01T12:00:00-03:00",
};

async function mockApi(page: Page, role: "worker" | "employer") {
  await page.route("**/api/v1/**", (route) => {
    const url = route.request().url();
    const json = (body: unknown) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });

    if (url.includes("/auth/me"))
      return json({
        id: "user-1",
        email: "demo@staffya.com",
        full_name: "María Fernanda Gutiérrez de la Torre",
        role,
        status: "activo",
        is_active: true,
        is_verified: true,
      });
    if (url.includes("/workers/me/profile")) return json(WORKER_PROFILE);
    if (url.includes("/shifts/feed")) return json([shift(), shift({ id: "shift-2" })]);
    if (url.includes("/shifts/me"))
      return json([
        shift({ status: "publicado" }),
        shift({ id: "s2", status: "asignado", worker_profile_id: "wp-1" }),
        shift({ id: "s3", status: "pagado", worker_profile_id: "wp-2" }),
        shift({ id: "s4", status: "cancelado" }),
      ]);
    if (url.includes("/applications/mine")) return json([]);
    return json([]);
  });
}

const SCREENS = [
  "/",
  "/login",
  "/register",
  "/feed",
  "/shifts",
  "/shifts/new",
  "/my-shifts",
  "/profile",
  "/search",
  "/chats",
  "/subscription",
  "/terminos",
];

async function auditOverflow(page: Page, path: string) {
  await page.goto(path);
  await page.waitForTimeout(1200);
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out: { tag: string; cls: string; text: string; left: number; right: number }[] = [];

    const scrollers = Array.from(document.querySelectorAll("*")).filter((el) => {
      const s = getComputedStyle(el);
      return s.overflowX === "auto" || s.overflowX === "scroll";
    });
    const insideScroller = (el: Element) =>
      scrollers.some((c) => c !== el && c.contains(el));

    for (const el of Array.from(document.querySelectorAll("body *"))) {
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden" || s.opacity === "0") continue;
      if (insideScroller(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > vw + 1 || r.left < -1) {
        out.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className || "").toString().slice(0, 100),
          text: (el.textContent || "").trim().slice(0, 50),
          left: Math.round(r.left),
          right: Math.round(r.right),
        });
      }
    }
    return { vw, out, scrollWidth: document.documentElement.scrollWidth };
  });
}

for (const role of ["worker", "employer"] as const) {
  test(`encuadre 390px — ${role}`, async ({ page }) => {
    await skipSplash(page);
    await injectSession(page);
    await blockExternalHosts(page);
    await mockEmptyNotifications(page);
    await mockApi(page, role);

    const findings: string[] = [];
    for (const path of SCREENS) {
      const r = await auditOverflow(page, path);
      const bodyScrolls = r.scrollWidth > r.vw + 1;
      if (r.out.length > 0 || bodyScrolls) {
        findings.push(
          `\n### ${path} (vw=${r.vw}, scrollWidth=${r.scrollWidth})\n` +
            r.out
              .map((o) => `  <${o.tag}> l=${o.left} r=${o.right} "${o.text}" | ${o.cls}`)
              .join("\n")
        );
      }
    }
    if (findings.length) console.log(`=== ${role} ===` + findings.join("\n"));
    expect(findings.join("\n")).toBe("");
  });
}
