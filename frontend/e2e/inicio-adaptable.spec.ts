import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, isoEnDias, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

/**
 * El Inicio del trabajador en pantallas angostas y con la letra grande
 * (revisión del 2026-11-19): «Cerca tuyo» no corta el horario ni la
 * distancia, y a 320 px con el texto al 200 % no hay scroll horizontal de
 * página ni títulos partidos letra por letra.
 */
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const LOCAL_LARGO = "Parrilla y Cervecería Artesanal «La Esquina del Gaucho» de Palermo Soho";
const turno = (id: string, extra: Record<string, unknown>) => ({
  id, company_id: "company-1", position: "bartender", quantity: 1,
  start_at: isoEnDias(2, "19:00"), end_at: isoEnDias(2, "23:00"), pay_amount: "54000", currency: "ARS", tips: false,
  dress_code: null, urgent: false, address: null, city: "Palermo, CABA", latitude: -34.5875, longitude: -58.4257,
  title: null, description: null, status: "publicado", worker_profile_id: null,
  check_in_latitude: null, check_in_longitude: null, check_in_at: null, check_out_latitude: null, check_out_longitude: null, check_out_at: null,
  paid_at: null, created_at: "2026-07-01T12:00:00-03:00", company_name: "Bar Lavalle", company_logo_url: null, company_verified: true, ...extra,
});

async function inicio(page: Page, feed: unknown[]) {
  await injectSession(page); await skipSplash(page); await blockExternalHosts(page); await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json({ id: "u1", email: "d@s.com", full_name: "Maximiliano Fernández", role: "worker", status: "activo", is_active: true, is_verified: true })));
  await page.route("**/api/v1/shifts/feed**", (r) => r.fulfill(json(feed)));
  await page.route("**/api/v1/applications/mine", (r) => r.fulfill(json([])));
  await page.route("**/api/v1/workers/me/profile", (r) =>
    r.fulfill(json({ id: "p1", user_id: "u1", full_name: "Maximiliano Fernández", photo_url: null, city: "Palermo, CABA", latitude: -34.5875, longitude: -58.4257, skills: ["mozo"], languages: [], certifications: [], is_available: true, rating: 4.8, events_completed: 10, punctuality_rate: 0.95, cancellations: 0, badges: [], level: "plata" }))
  );
}

const FEED = [
  turno("s1", { latitude: -34.5876, company_name: "Bar Mirasol" }),
  turno("s2", { position: "cocinero", company_name: LOCAL_LARGO, latitude: -34.598, pay_amount: "1250000" }),
  turno("s3", { position: "mozo", company_name: "Don Pascual", urgent: true, latitude: -34.6, pay_amount: "1250000" }),
];

for (const ancho of [320, 360, 390]) {
  test(`«Cerca tuyo» a ${ancho} px: el local se corta, cuándo y distancia no`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 800 });
    await inicio(page, FEED);
    await page.goto("/feed");
    const fila = page.getByTestId("feed-nearby-card").filter({ hasText: "Parrilla y Cervecería" });
    await expect(fila).toBeVisible();
    // El local es lo único con elipsis.
    const local = fila.locator(".truncate");
    expect(await local.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    // La distancia: fija al lado del local, entera y en el mismo renglón.
    const distancia = fila.getByTestId("feed-nearby-distancia");
    await expect(distancia).toContainText(" km");
    const dm = await distancia.evaluate((el) => ({ sobra: el.scrollWidth > el.clientWidth, ws: getComputedStyle(el).whiteSpace, shrink: getComputedStyle(el).flexShrink }));
    expect(dm).toEqual({ sobra: false, ws: "nowrap", shrink: "0" });
    const cl = await local.boundingBox();
    const cd = await distancia.boundingBox();
    expect(Math.abs(cl!.y - cd!.y)).toBeLessThan(6);
    // El cuándo, en su renglón: el día y el rango horario son dos bloques que no se parten por dentro.
    const cuando = fila.getByTestId("feed-nearby-cuando");
    await expect(cuando).toContainText(/\d{2}:\d{2}\s*–\s*\d{2}:\d{2}/);
    const medidas = await cuando.evaluate((el) => ({ sobra: el.scrollWidth > el.clientWidth, tam: getComputedStyle(el).fontSize, peso: getComputedStyle(el).fontWeight }));
    expect(medidas).toEqual({ sobra: false, tam: "13px", peso: "600" });
    const bloques = await cuando.locator("> span").all();
    expect(bloques.length).toBe(2);
    const rc = (await cuando.boundingBox())!;
    const rf = (await fila.boundingBox())!;
    const pago = (await fila.locator(".fila-cerca-pago").boundingBox())!;
    const puesto = (await fila.locator(".fila-cerca-puesto").boundingBox())!;
    // El renglón del cuándo cruza hasta el borde derecho de la grilla, también debajo del pago…
    expect(Math.round(rc.x + rc.width)).toBe(Math.round(pago.x + pago.width));
    // …así que tiene más de 200 px en cualquier celular.
    expect(rc.width).toBeGreaterThan(200);
    // El pago queda arriba a la derecha, alineado con el puesto (no más abajo que su renglón).
    expect(pago.y).toBeLessThan(puesto.y + puesto.height);
    for (const b of bloques) {
      expect(await b.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe("nowrap");
      expect(await b.evaluate((el) => el.getClientRects().length)).toBe(1);
      const rb = (await b.boundingBox())!;
      expect(rb.height).toBeLessThan(20); // un solo renglón
      // El bloque entero cabe en el rectángulo del contenedor y en el de la fila (sin tolerancia).
      expect(rb.x).toBeGreaterThanOrEqual(rc.x);
      expect(rb.x + rb.width).toBeLessThanOrEqual(rc.x + rc.width);
      expect(rb.x + rb.width).toBeLessThanOrEqual(rf.x + rf.width);
    }
    // Y la fila entera no se sale de la pantalla.
    const caja = await fila.boundingBox();
    expect(caja!.x + caja!.width).toBeLessThanOrEqual(ancho);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
}

for (const tema of ["light", "dark"] as const) {
  test(`a 320 px con el texto al 200 % no hay scroll horizontal ni títulos partidos (${tema})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await setTheme(page, tema);
    await inicio(page, FEED);
    await page.goto("/feed");
    // El texto al 200 % (como si la persona lo agrandara en el sistema).
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    const tarjeta = page.getByTestId("feed-hero-card");
    await expect(tarjeta).toBeVisible();
    await expect(page.getByTestId("feed-nearby-card").first()).toBeVisible();
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe("32px");
    // Sin scroll horizontal de página.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    // El pago baja si no entra: sigue entero y dentro de la tarjeta.
    const caja = await tarjeta.boundingBox();
    const pago = tarjeta.locator("p.tabular-nums");
    const cp = await pago.boundingBox();
    expect(cp!.x + cp!.width).toBeLessThanOrEqual(caja!.x + caja!.width);
    // Ni el puesto ni el título (palabras enteras, no letra por letra): cada palabra cabe en su caja.
    const partido = await page.evaluate(() => {
      const malos: string[] = [];
      for (const el of Array.from(document.querySelectorAll("h1, h3, [data-testid='feed-nearby-card'] span.font-bold"))) {
        for (const palabra of (el.textContent ?? "").split(/\s+/).filter((w) => w.length > 3)) {
          const r = document.createRange();
          const nodo = Array.from(el.childNodes).find((n) => n.textContent?.includes(palabra));
          if (!nodo || nodo.nodeType !== 3) continue;
          const i = nodo.textContent!.indexOf(palabra);
          r.setStart(nodo, i); r.setEnd(nodo, i + palabra.length);
          if (r.getClientRects().length > 1) malos.push(palabra);
        }
      }
      return malos;
    });
    expect(partido).toEqual([]);
    // Las filas de «Cerca tuyo» también: el pago entero, dentro de la fila.
    for (const fila of await page.getByTestId("feed-nearby-card").all()) {
      const f = await fila.boundingBox();
      const p = await fila.locator("span.tabular-nums").boundingBox();
      expect(p!.x + p!.width).toBeLessThanOrEqual(f!.x + f!.width);
      expect(f!.x + f!.width).toBeLessThanOrEqual(320);
    }
  });
}

test("a 320 px con el texto al 200 % un puesto de una sola palabra larga se parte antes que desbordar", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await inicio(page, [
    turno("s1", { position: "recepcionista", latitude: -34.5876, pay_amount: "1250000" }),
    turno("s2", { position: "recepcionista", company_name: "Bar", latitude: -34.598, pay_amount: "1250000" }),
    turno("s3", { position: "personal_eventos", company_name: "Bar", latitude: -34.6, pay_amount: "1250000" }),
  ]);
  await page.goto("/feed");
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await expect(page.getByTestId("feed-hero-card")).toBeVisible();
  await expect(page.getByTestId("feed-nearby-card").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const tarjeta = await page.getByTestId("feed-hero-card").boundingBox();
  const h3 = await page.getByTestId("feed-hero-card").locator("h3").boundingBox();
  expect(h3!.x + h3!.width).toBeLessThanOrEqual(tarjeta!.x + tarjeta!.width);
  for (const fila of await page.getByTestId("feed-nearby-card").all()) {
    const f = await fila.boundingBox();
    expect(f!.x + f!.width).toBeLessThanOrEqual(320);
    // Nada de adentro se sale de la fila.
    const sale = await fila.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return Array.from(el.querySelectorAll("*")).filter((n) => n.getBoundingClientRect().right > r.right + 0.5).map((n) => `${n.tagName}.${(n as HTMLElement).className}`.slice(0, 80) + `@${Math.round(n.getBoundingClientRect().right - r.right)}`);
    });
    expect(sale).toEqual([]);
  }
});

test("la nube chica se oculta por debajo de 360 px y aparece desde 360", async ({ page }) => {
  await inicio(page, [turno("s1", {})]);
  const lejana = page.locator("img.nube-cielo-lejos");
  await page.setViewportSize({ width: 359, height: 800 });
  await page.goto("/feed");
  await expect(page.getByTestId("feed-hero-card")).toBeVisible();
  await expect(lejana).toBeHidden();
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(lejana).toBeVisible();
});

test("dentro de la hoja, la regla del esqueleto no pisa otros animate-pulse (el micrófono que escucha)", async ({ page }) => {
  await setTheme(page, "dark");
  await inicio(page, [turno("s1", {})]);
  await page.goto("/feed");
  await expect(page.getByTestId("feed-hero-card")).toBeVisible();
  const r = await page.evaluate(() => {
    const hoja = document.querySelector(".estilo-suave .hoja")!;
    hoja.insertAdjacentHTML(
      "beforeend",
      '<div id="mic" class="animate-pulse bg-danger text-white">m</div><div id="esq" data-skeleton class="animate-pulse bg-surface">e</div>',
    );
    const bg = (id: string) => getComputedStyle(document.getElementById(id)!).backgroundColor;
    const campo = getComputedStyle(document.querySelector(".estilo-suave")!).getPropertyValue("--suave-campo").trim();
    const probe = document.createElement("div");
    probe.style.backgroundColor = campo;
    document.body.appendChild(probe);
    const campoRgb = getComputedStyle(probe).backgroundColor;
    probe.remove();
    const probe2 = document.createElement("div");
    probe2.style.backgroundColor = "var(--color-danger)";
    document.body.appendChild(probe2);
    const dangerRgb = getComputedStyle(probe2).backgroundColor;
    probe2.remove();
    return { mic: bg("mic"), esq: bg("esq"), campoRgb, dangerRgb };
  });
  expect(r.mic).toBe(r.dangerRgb);
  expect(r.esq).toBe(r.campoRgb);
  expect(r.mic).not.toBe(r.esq);
});
