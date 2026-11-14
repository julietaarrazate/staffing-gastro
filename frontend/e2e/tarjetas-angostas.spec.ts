import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * G24 · las tarjetas no se salen de la pantalla con un nombre largo. En un
 * celular angosto, una grilla sin `grid-cols-1` toma el ancho mínimo de su
 * contenido (un nombre sin espacios) y empuja la tarjeta, y el botón, fuera de
 * la pantalla. Se mide, en 390, 360 y 320 px de ancho de viewport, con un
 * nombre de 60 letras sin espacios (el peor caso): la página no tiene scroll
 * horizontal, ninguna tarjeta se sale y los botones quedan enteros.
 */

const NOMBRE = "Maximilianoalejandrofernandezdelacruzsanchezvillanuevaortiz".slice(0, 60);
const ANCHOS = [390, 360, 320];

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

const USER = {
  id: "u-1",
  email: "demo@staffya.com",
  full_name: "Demo",
  role: "employer",
  status: "activo",
  is_active: true,
  is_verified: true,
};

async function base(page: Page, role: "employer" | "worker" | "admin") {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json({ ...USER, role })));
}

/** Mide scroll horizontal y que cada elemento de `selectores` entre en el viewport. */
async function medir(page: Page, ancho: number, pantalla: string, selectores: string[]) {
  const m = await page.evaluate((sels) => {
    const rect = (e: Element) => {
      const r = e.getBoundingClientRect();
      return { left: Math.round(r.left * 10) / 10, right: Math.round(r.right * 10) / 10, w: Math.round(r.width * 10) / 10 };
    };
    return {
      scrollW: document.documentElement.scrollWidth,
      items: sels.flatMap((s) =>
        Array.from(document.querySelectorAll(s))
          .filter((e) => e.getBoundingClientRect().width > 0)
          .map((e) => ({ s, ...rect(e), txt: (e.textContent ?? "").trim().slice(0, 14) }))
      ),
    };
  }, selectores);
  console.log(`MEDIDA ${pantalla} @${ancho}: ${JSON.stringify(m)}`);
  if (m.scrollW > ancho) {
    const culpables = await page.evaluate((w) =>
      Array.from(document.querySelectorAll("body *"))
        .filter((e) => {
          if (e.getBoundingClientRect().right <= w + 0.5 || e.getBoundingClientRect().width === 0) return false;
          for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
            if (getComputedStyle(p).overflowX !== "visible") return false;
          }
          return true;
        })
        .slice(0, 6)
        .map((e) => `${e.tagName}.${String(e.className).slice(0, 60)} right=${e.getBoundingClientRect().right}`), ancho);
    console.log(`CULPABLES ${pantalla} @${ancho}: ${JSON.stringify(culpables)}`);
    const sw = await page.evaluate(() =>
      Array.from(document.querySelectorAll("body, body *"))
        .filter((e) => e.scrollWidth > e.clientWidth + 1)
        .slice(0, 8)
        .map((e) => `${e.tagName}.${String(e.className).slice(0, 50)} sw=${e.scrollWidth} cw=${e.clientWidth} ox=${getComputedStyle(e).overflowX}`));
    console.log(`SCROLLERS ${pantalla} @${ancho}: ${JSON.stringify(sw)}`);
  }
  expect(m.scrollW, `${pantalla}: scroll horizontal a ${ancho}px`).toBeLessThanOrEqual(ancho);
  expect(m.items.length, `${pantalla}: hay elementos para medir`).toBeGreaterThan(0);
  for (const it of m.items) {
    expect(it.left, `${pantalla} ${it.s} «${it.txt}» a ${ancho}px (izquierda)`).toBeGreaterThanOrEqual(0);
    expect(it.right, `${pantalla} ${it.s} «${it.txt}» a ${ancho}px (derecha)`).toBeLessThanOrEqual(ancho);
  }
}

function applicant(id: string, verified: boolean) {
  return {
    application_id: `app-${id}`,
    worker_profile_id: id,
    full_name: NOMBRE,
    photo_url: null,
    rating: 4.8,
    is_available: true,
    status: "pendiente",
    created_at: "2026-11-10T12:00:00-03:00",
    events_completed: 12,
    punctuality_rate: 0.95,
    years_experience: 4,
    badges: [],
    level: "bronce",
    identidad_verificada: verified,
  };
}

function candidate(id: string) {
  return {
    profile_id: id,
    user_id: `u-${id}`,
    full_name: NOMBRE,
    photo_url: null,
    rating: 4.8,
    score: 0.9,
    distance_km: 1.2,
    events_completed: 12,
    punctuality_rate: 0.95,
    years_experience: 4,
    badges: [],
    level: "bronce",
    identidad_verificada: true,
  };
}

async function mockCandidatos(page: Page) {
  await base(page, "employer");
  await page.route("**/api/v1/shifts/shift-1", (r) => r.fulfill(json({}, 404)));
  await page.route("**/api/v1/applications/shifts/shift-1", (r) =>
    r.fulfill(json([applicant("wp-1", true), applicant("wp-2", true), applicant("wp-3", false)]))
  );
  await page.route("**/api/v1/shifts/shift-1/candidates", (r) =>
    r.fulfill(json([candidate("c-1"), candidate("c-2")]))
  );
}

test("postulantes: nombre de 60 letras, sin desborde y con «Asignar» entero", async ({ page }) => {
  await mockCandidatos(page);
  for (const ancho of ANCHOS) {
    await page.setViewportSize({ width: ancho, height: 800 });
    await page.goto("/shifts/shift-1/candidates");
    await expect(page.getByText(NOMBRE).first()).toBeVisible({ timeout: 15_000 });
    await medir(page, ancho, "postulantes", ["div.no-select", "div.no-select button"]);
  }
});

test("recomendados: nombre de 60 letras, sin desborde y con «Asignar» entero", async ({ page }) => {
  await mockCandidatos(page);
  for (const ancho of ANCHOS) {
    await page.setViewportSize({ width: ancho, height: 800 });
    await page.goto("/shifts/shift-1/candidates");
    await page.getByRole("button", { name: /Recomendados/ }).click();
    await expect(page.getByText(NOMBRE).first()).toBeVisible({ timeout: 15_000 });
    await medir(page, ancho, "recomendados", ["div.no-select", "div.no-select button"]);
  }
});

test("lista de chats: nombre de 60 letras, sin desborde", async ({ page }) => {
  await base(page, "worker");
  const conv = (id: string) => ({
    shift_id: id,
    shift_title: NOMBRE,
    other_party_name: NOMBRE,
    other_party_photo: null,
    last_message: NOMBRE + NOMBRE,
    last_message_at: new Date().toISOString(),
    unread_count: 3,
  });
  await page.route("**/api/v1/chats", (r) => r.fulfill(json([conv("s-1"), conv("s-2")])));
  for (const ancho of ANCHOS) {
    await page.setViewportSize({ width: ancho, height: 800 });
    await page.goto("/chats");
    await expect(page.getByText(NOMBRE).first()).toBeVisible({ timeout: 15_000 });
    await medir(page, ancho, "chats", ['a[href^="/chats/"]', 'a[href^="/chats/"] span']);
  }
});

async function mockAdmin(page: Page) {
  await base(page, "admin");
  await page.route("**/api/v1/admin/today", (r) => r.fulfill(json({ urgent_uncovered: 0, no_shows_today: 0 })));
}

test("admin en vivo: nombre de 60 letras, sin desborde", async ({ page }) => {
  await mockAdmin(page);
  const turno = (id: string) => ({
    id,
    title: NOMBRE,
    position: "mozo",
    status: "buscando_personal",
    start_at: new Date(Date.now() + 3 * 3_600_000).toISOString(),
    end_at: new Date(Date.now() + 9 * 3_600_000).toISOString(),
    city: NOMBRE,
    company_name: NOMBRE,
    urgent: true,
    escalated: true,
    escalated_at: new Date(Date.now() - 600_000).toISOString(),
    published_at: new Date(Date.now() - 300_000).toISOString(),
    minutes_open: 125,
    applications: 3,
  });
  await page.route("**/api/v1/admin/live-shifts**", (r) =>
    r.fulfill(
      json({ generated_at: new Date().toISOString(), total: 2, urgent: 2, escalated: 2, shifts: [turno("a"), turno("b")] })
    )
  );
  for (const ancho of ANCHOS) {
    await page.setViewportSize({ width: ancho, height: 800 });
    await page.goto("/admin/en-vivo");
    await expect(page.getByText(NOMBRE).first()).toBeVisible({ timeout: 15_000 });
    await medir(page, ancho, "en-vivo", ['ul[aria-label="Turnos sin cubrir"] > li', 'ul[aria-label="Turnos sin cubrir"] > li > *']);
  }
});

test("admin soporte: nombre de 60 letras, sin desborde", async ({ page }) => {
  await mockAdmin(page);
  const ticket = (id: string) => ({
    id,
    user_id: "u-x",
    user_full_name: NOMBRE,
    user_email: "x@y.com",
    user_role: "worker",
    category: "general",
    subject: NOMBRE + NOMBRE,
    status: "abierto",
    message_count: 3,
    last_message_at: null,
    created_at: null,
  });
  await page.route("**/api/v1/support/tickets?**", (r) => r.fulfill(json([ticket("t-1"), ticket("t-2")])));
  for (const ancho of ANCHOS) {
    await page.setViewportSize({ width: ancho, height: 800 });
    await page.goto("/admin/support");
    await expect(page.getByText(NOMBRE).first()).toBeVisible({ timeout: 15_000 });
    await medir(page, ancho, "soporte", ['a[href^="/support/"]']);
  }
});
