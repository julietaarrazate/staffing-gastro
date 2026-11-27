import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, isoEnDias, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

/**
 * Una carga que falla NO se ve como «no hay nada»: Buscar, Mis turnos, el
 * Inicio, el Mapa y «Hoy» del admin muestran «No pudimos cargar» con
 * «Reintentar», y al reintentar (ya con respuesta buena) aparece lo que hay.
 * Se mira renderizado en claro y de noche, con el contraste del texto.
 */
const json = (body: unknown, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const falla = () => json({ detail: "boom" }, 500);
const WORKER = { id: "u", email: "w@oido.test", full_name: "Sofía Demo", role: "worker", status: "activo", is_active: true, is_verified: true };
const ADMIN = { id: "a", email: "admin@oido.test", full_name: "Julieta Demo", role: "admin", status: "active", is_active: true, is_verified: true };
const turno = (id: string, company: string) => ({
  id, company_id: `c-${id}`, position: "mozo", quantity: 1, start_at: isoEnDias(1, "21:00"), end_at: isoEnDias(2, "02:00"), pay_amount: "20000", currency: "ARS",
  tips: true, meal: false, dress_code: null, urgent: false, address: null, city: "Palermo, CABA", latitude: -34.585, longitude: -58.43, title: null, description: null,
  status: "publicado", worker_profile_id: null, created_at: "2026-11-01T12:00:00-03:00", company_name: company, company_logo_url: null, company_verified: false,
});

const VACIOS = /No hay turnos|Todo tranquilo|Ya viste todas|Todavía no|Al día|Ninguno ahora|Ninguna/;

async function base(page: Page, user: unknown, theme: "light" | "dark" = "light") {
  await setTheme(page, theme);
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  // Catch-all primero: Playwright resuelve la última ruta registrada.
  await page.route("**/api/v1/**", (r) => (r.request().method() === "GET" ? r.fulfill(json([])) : r.continue()));
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json(user)));
}

/** Primer pedido: 500; desde ahí, la respuesta buena. */
function fallaUnaVez(page: Page, patron: string, buena: unknown) {
  let rota = true;
  return page
    .route(patron, (r) => (rota ? r.fulfill(falla()) : r.fulfill(json(buena))))
    .then(() => ({ arreglar: () => (rota = false) }));
}

const aviso = (page: Page) => page.getByRole("alert").filter({ hasText: "No pudimos cargar" });

for (const theme of ["light", "dark"] as const) {
  test(`${theme}: Buscar con el feed caído dice «No pudimos cargar», no «no hay turnos», y Reintentar vuelve a pedir`, async ({ page }) => {
    await base(page, WORKER, theme);
    const feed = await fallaUnaVez(page, "**/api/v1/shifts/feed*", [turno("b1", "Bar Lavalle")]);
    await page.goto("/buscar");
    await expect(aviso(page)).toBeVisible();
    await expect(page.getByText("Revisá tu conexión y probá de nuevo.")).toBeVisible();
    await expect(page.getByText(VACIOS)).toHaveCount(0);

    // Contraste del texto del error sobre su fondo (claro y oscuro).
    const [color, fondo] = await page.getByRole("heading", { name: "No pudimos cargar" }).evaluate((el) => {
      let bg = "";
      for (let n: Element | null = el; n; n = n.parentElement) {
        const c = getComputedStyle(n).backgroundColor;
        if (c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent") { bg = c; break; }
      }
      return [getComputedStyle(el).color, bg || getComputedStyle(document.body).backgroundColor];
    });
    expect(contraste(color, fondo)).toBeGreaterThanOrEqual(4.5);
    // Captura sólo a pedido (CAPTURAS_DIR): no escribe nada en el repo.
    if (process.env.CAPTURAS_DIR) await page.screenshot({ path: `${process.env.CAPTURAS_DIR}/buscar-error-${theme}.png` });

    feed.arreglar();
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.getByText("Bar Lavalle")).toBeVisible();
    await expect(aviso(page)).toHaveCount(0);
  });
}

test("Mis turnos: si falla /applications/mine no muestra «sin postulaciones» sino el error, y Reintentar recarga", async ({ page }) => {
  await base(page, WORKER);
  const apps = await fallaUnaVez(page, "**/api/v1/applications/mine**", [
    { id: "ap1", status: "pendiente", shift_id: "s1", shift: { ...turno("s1", "Bar Postulado"), status: "publicado" } },
  ]);
  await page.goto("/my-shifts");
  await expect(aviso(page)).toBeVisible();
  await expect(page.getByText(/Todavía no|No tenés|Sin postulaciones/)).toHaveCount(0);

  apps.arreglar();
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expect(aviso(page)).toHaveCount(0);
});

test("Inicio: con el feed caído se ve el error con Reintentar, nunca el vacío", async ({ page }) => {
  await base(page, WORKER);
  const feed = await fallaUnaVez(page, "**/api/v1/shifts/feed**", [turno("f1", "Bar Inicio")]);
  await page.goto("/feed");
  await expect(aviso(page)).toBeVisible();
  await expect(page.getByText(VACIOS)).toHaveCount(0);
  feed.arreglar();
  await page.getByRole("button", { name: "Reintentar" }).first().click();
  await expect(aviso(page)).toHaveCount(0);
});

test("Mapa: con el feed caído la tarjeta dice «No pudimos cargar» y Reintentar vuelve a pedir", async ({ page }) => {
  await base(page, WORKER);
  let pedidos = 0;
  await page.route("**/api/v1/shifts/feed**", (r) => {
    pedidos += 1;
    return r.fulfill(falla());
  });
  await page.goto("/map");
  const tarjeta = page.getByTestId("mapa-vacio");
  await expect(tarjeta).toContainText("No pudimos cargar", { timeout: 20_000 });
  await expect(tarjeta).not.toContainText("No hay turnos cerca");
  const antes = pedidos;
  await tarjeta.getByRole("button", { name: "Reintentar" }).click();
  await expect.poll(() => pedidos).toBeGreaterThan(antes);
});

test("Hoy del admin: un contador que no cargó no dice «Al día»; Reintentar lo vuelve a pedir", async ({ page }) => {
  await base(page, ADMIN);
  await page.route("**/api/v1/admin/stats", (r) => r.fulfill(json({ coverage_sample_size: 0, avg_time_to_fill_minutes: null, pct_filled_under_10_min: null })));
  await page.route("**/api/v1/admin/today", (r) => r.fulfill(json({ urgent_uncovered: 0, no_shows_today: 0 })));
  await page.route("**/api/v1/identity/claims/pending", (r) => r.fulfill(json([])));
  await page.route("**/api/v1/admin/leads/summary**", (r) => r.fulfill(json({ counts: { nuevo: 4 }, total: 4 })));
  const tickets = await fallaUnaVez(page, "**/api/v1/support/tickets?**", [{ id: "t1" }, { id: "t2" }]);
  await page.goto("/admin");

  const tarjeta = page.getByRole("link", { name: /Tickets de soporte abiertos/ });
  await expect(tarjeta).toContainText("No pudimos cargar");
  await expect(tarjeta).not.toContainText("Al día");
  await expect(aviso(page)).toBeVisible();

  tickets.arreglar();
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expect(tarjeta).toContainText("2");
  await expect(tarjeta).toContainText("Responder");
  await expect(aviso(page)).toHaveCount(0);
});

function contraste(a: string, b: string) {
  const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
  const lum = ([r, g, bl]: number[]) => {
    const x = [r, g, bl].map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * x[0] + 0.7152 * x[1] + 0.0722 * x[2];
  };
  const [p, q] = [lum(rgb(a)), lum(rgb(b))].sort((m, n) => n - m);
  return (p + 0.05) / (q + 0.05);
}
