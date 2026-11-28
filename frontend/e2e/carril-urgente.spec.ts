import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, isoEnDias, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

/**
 * Carril urgente (ADR-0032, Julieta 2026-11-27): en un turno que empieza en
 * menos de 6 horas, postularse es «Puedo ir ya» y, si el comercio acepta, el
 * turno queda confirmado. La persona lo ve (botón + pregunta antes de
 * postular) y el comercio también («Puede ir ya», «Aceptar», «ya quedó
 * confirmado»). Con `apply_commits: false` todo sigue como antes. API
 * simulada. Con CAPTURAS=<carpeta> también guarda las capturas a 390 px.
 */
const json = (body: unknown, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const CAPTURAS = process.env.CAPTURAS;
const WORKER = { id: "u", email: "w@oido.test", full_name: "Sofía Demo", role: "worker", status: "activo", is_active: true, is_verified: true };
const EMPLOYER = { id: "user-1", email: "c@oido.test", full_name: "Julieta Demo", role: "employer", status: "activo", is_active: true, is_verified: true };

const turno = (id: string, company: string, extra: Record<string, unknown> = {}) => ({
  id, company_id: `c-${id}`, position: "mozo", quantity: 1, start_at: isoEnDias(0, "23:30"), end_at: isoEnDias(1, "03:00"), pay_amount: "20000", currency: "ARS",
  tips: true, meal: false, dress_code: null, urgent: true, address: null, city: "Palermo, CABA", latitude: -34.585, longitude: -58.43, title: null, description: null,
  status: "publicado", worker_profile_id: null, created_at: "2026-11-01T12:00:00-03:00", company_name: company, company_logo_url: null, company_verified: false, ...extra,
});

async function buscar(page: Page, commits: boolean, theme: "light" | "dark" = "light", exigeReconocer = false) {
  const posts: string[] = [];
  const cuerpos: (Record<string, unknown> | null)[] = [];
  await setTheme(page, theme);
  await page.setViewportSize({ width: 390, height: 844 });
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await page.route("**/api/v1/**", (r) => (r.request().method() === "GET" ? r.fulfill(json([])) : r.continue()));
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json(WORKER)));
  await page.route("**/api/v1/shifts/feed*", (r) => r.fulfill(json([turno("b1", "Bar Lavalle", { apply_commits: commits }), turno("b2", "Café Belgrano", { apply_commits: commits })])));
  await page.route("**/api/v1/applications/shifts/*", (r) => {
    if (r.request().method() !== "POST") return r.fulfill(json([]));
    const cuerpo = r.request().postDataJSON() as Record<string, unknown> | null;
    // Pantalla vieja: el turno ya entró en las 6 h y falta el reconocimiento.
    if (exigeReconocer && !cuerpo?.puedo_ir_ya) {
      return r.fulfill(json({ detail: { code: "puedo_ir_ya_requerido", message: "Este turno empieza pronto: confirmá que podés ir." } }, 409));
    }
    posts.push(r.request().url());
    cuerpos.push(cuerpo);
    return r.fulfill(json({ id: "a1", shift_id: "b1", worker_profile_id: "wp", status: "pendiente" }, 201));
  });
  await page.goto("/buscar");
  await expect(page.getByTestId("buscar-card")).toHaveCount(2);
  return Object.assign(posts, { cuerpos });
}

for (const theme of ["light", "dark"] as const) {
  test(`${theme}: «Puedo ir ya» no postula directo: pregunta, y «Ahora no» no manda nada`, async ({ page }) => {
    const posts = await buscar(page, true, theme);
    const primero = page.getByTestId("buscar-card").first();
    await expect(primero.getByRole("button", { name: "Puedo ir ya" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Postularme" })).toHaveCount(0);

    await primero.getByRole("button", { name: "Puedo ir ya" }).click();
    const dialogo = page.getByRole("dialog", { name: "¿Podés ir a este turno?" });
    await expect(dialogo).toBeVisible();
    await expect(dialogo).toContainText("Empieza hoy a las 23:30.");
    await expect(dialogo).toContainText("Si el comercio te acepta, el turno queda confirmado en el momento: no vas a tener que confirmar de nuevo. Si después no podés ir, cuenta como una cancelación.");
    // El único ámbar de la confirmación es «Sí, puedo ir».
    await expect(dialogo.locator("button.boton-relieve")).toHaveCount(1);
    await expect(dialogo.getByRole("button", { name: "Sí, puedo ir" })).toHaveClass(/boton-relieve/);
    // Sin desbordes a 390 y a 320.
    for (const ancho of [390, 320]) {
      await page.setViewportSize({ width: ancho, height: 700 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const caja = await dialogo.boundingBox();
      expect(caja!.x).toBeGreaterThanOrEqual(0);
      expect(caja!.x + caja!.width).toBeLessThanOrEqual(ancho);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/urgente-trabajador-${theme}.png` });

    await dialogo.getByRole("button", { name: "Ahora no" }).click();
    await expect(dialogo).toBeHidden();
    expect(posts).toHaveLength(0);
    await expect(page.getByTestId("buscar-card")).toHaveCount(2);

    await primero.getByRole("button", { name: "Puedo ir ya" }).click();
    await page.getByRole("button", { name: "Sí, puedo ir" }).click();
    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0]).toContain("/applications/shifts/b1");
    // El reconocimiento viaja en el cuerpo: el servidor lo guarda.
    expect(posts.cuerpos[0]).toEqual({ puedo_ir_ya: true });
    await expect(page.getByTestId("buscar-card")).toHaveCount(1);
  });
}

test("con apply_commits en false todo sigue igual: «Postularme» y postula directo, sin pregunta", async ({ page }) => {
  const posts = await buscar(page, false);
  await expect(page.getByRole("button", { name: "Puedo ir ya" })).toHaveCount(0);
  await page.getByTestId("buscar-card").first().getByRole("button", { name: "Postularme" }).click();
  await expect.poll(() => posts.length).toBe(1);
  await expect(page.getByRole("dialog", { name: "¿Podés ir a este turno?" })).toHaveCount(0);
  // Sin reconocimiento, sin cuerpo.
  expect(posts.cuerpos[0]).toBeNull();
});

test("pantalla vieja: el servidor contesta 409 con código, se abre la pregunta y «Sí, puedo ir» reintenta con el reconocimiento", async ({ page }) => {
  const posts = await buscar(page, false, "light", true);
  const primero = page.getByTestId("buscar-card").first();
  // La pantalla cargó «Postularme» (apply_commits en false).
  await primero.getByRole("button", { name: "Postularme" }).click();
  const dialogo = page.getByRole("dialog", { name: "¿Podés ir a este turno?" });
  await expect(dialogo).toBeVisible();
  expect(posts).toHaveLength(0);
  await dialogo.getByRole("button", { name: "Sí, puedo ir" }).click();
  await expect.poll(() => posts.length).toBe(1);
  expect(posts.cuerpos[0]).toEqual({ puedo_ir_ya: true });
  await expect(page.getByTestId("buscar-card")).toHaveCount(1);
});

test("pantalla vieja: «Ahora no» después del 409 no postula y deja el turno", async ({ page }) => {
  const posts = await buscar(page, false, "light", true);
  await page.getByTestId("buscar-card").first().getByRole("button", { name: "Postularme" }).click();
  await page.getByRole("dialog", { name: "¿Podés ir a este turno?" }).getByRole("button", { name: "Ahora no" }).click();
  await expect(page.getByRole("dialog", { name: "¿Podés ir a este turno?" })).toBeHidden();
  expect(posts).toHaveLength(0);
  await expect(page.getByTestId("buscar-card")).toHaveCount(2);
});

// ---------- Comercio ----------
const persona = (id: string, nombre: string, extra: Record<string, unknown> = {}) => ({
  application_id: `app-${id}`, worker_profile_id: `wp-${id}`, full_name: nombre, photo_url: null, rating: 4.6, is_available: true,
  status: "pendiente", created_at: "2026-11-10T12:00:00-03:00", events_completed: 8, punctuality_rate: 0.92, years_experience: 2,
  badges: [], level: "bronce", identidad_verificada: false, falta_verificar: false,
  es_favorito: false, trabajo_aca: false, turnos_en_el_puesto: 0, nuevo_verificado: false, se_ofrecio_para_ya: false, ...extra,
});
const SHIFT = { ...turno("shift-1", "Bar Lavalle"), id: "shift-1", company_id: "c1", urgent: true };

async function candidatos(page: Page, postulantes: unknown[], asignar: { status: number; body: unknown }, theme: "light" | "dark" = "light") {
  const contador = { lista: 0, assign: 0 };
  await setTheme(page, theme);
  await page.setViewportSize({ width: 390, height: 844 });
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json(EMPLOYER)));
  await page.route("**/api/v1/shifts/shift-1", (r) => r.fulfill(json(SHIFT)));
  await page.route("**/api/v1/applications/shifts/shift-1", (r) => {
    contador.lista += 1;
    return r.fulfill(json(postulantes));
  });
  await page.route("**/api/v1/shifts/shift-1/candidates", (r) => r.fulfill(json([])));
  await page.route("**/api/v1/shifts/shift-1/assign", (r) => {
    contador.assign += 1;
    return r.fulfill(json(asignar.body, asignar.status));
  });
  return contador;
}

const LUCAS = persona("1", "Lucas Medina", { se_ofrecio_para_ya: true, rating: 4.9, events_completed: 30 });
const ANA = persona("2", "Ana Paz", { se_ofrecio_para_ya: true });
const NICO = persona("3", "Nico Díaz");

for (const theme of ["light", "dark"] as const) {
  test(`${theme}: quien se ofreció para ya lleva «Puede ir ya» y su botón es «Aceptar»; los demás siguen con «Elegir»`, async ({ page }) => {
    await candidatos(page, [LUCAS, ANA, NICO], { status: 200, body: { ...SHIFT, status: "confirmado" } }, theme);
    await page.goto("/shifts/shift-1/candidates");
    const destacada = page.locator("[data-destacado]");
    await expect(destacada.getByTestId("puede-ir-ya")).toHaveText("Puede ir ya");
    await expect(destacada.getByRole("button", { name: "Aceptar a Lucas" })).toBeVisible();
    const filas = page.locator("[data-fila-candidato]");
    await expect(filas).toHaveCount(2);
    await expect(filas.filter({ hasText: "Ana Paz" }).getByTestId("puede-ir-ya")).toHaveText("Puede ir ya");
    await expect(filas.filter({ hasText: "Ana Paz" }).getByRole("button")).toHaveText("Aceptar");
    await expect(filas.filter({ hasText: "Nico Díaz" }).getByTestId("puede-ir-ya")).toHaveCount(0);
    await expect(filas.filter({ hasText: "Nico Díaz" }).getByRole("button")).toHaveText("Elegir");
    // Un solo ámbar.
    await expect(page.locator("button.boton-relieve")).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.setViewportSize({ width: 320, height: 700 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/urgente-candidatos-${theme}.png` });
  });
}

test("sin nadie que se haya ofrecido para ya, la pantalla es la de siempre", async ({ page }) => {
  await candidatos(page, [persona("1", "Lucas Medina"), NICO], { status: 200, body: { ...SHIFT, status: "asignado" } });
  await page.goto("/shifts/shift-1/candidates");
  await expect(page.getByTestId("puede-ir-ya")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Elegir a Lucas" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Aceptar/ })).toHaveCount(0);
});

test("al aceptar a quien se ofreció, «¡Oído!» dice que el turno quedó confirmado", async ({ page }) => {
  const c = await candidatos(page, [LUCAS, NICO], { status: 200, body: { ...SHIFT, status: "confirmado", worker_profile_id: "wp-1" } });
  await page.goto("/shifts/shift-1/candidates");
  await page.getByRole("button", { name: "Aceptar a Lucas" }).click();
  const oido = page.getByTestId("oido-elegido");
  await expect(oido).toContainText("Lucas ya se había ofrecido: el turno quedó confirmado.");
  await expect(oido).not.toContainText("falta que confirme");
  expect(c.assign).toBe(1);
});

test("al elegir a quien no se ofreció, «¡Oído!» sigue diciendo que falta que confirme", async ({ page }) => {
  await candidatos(page, [LUCAS, NICO], { status: 200, body: { ...SHIFT, status: "asignado", worker_profile_id: "wp-3" } });
  await page.goto("/shifts/shift-1/candidates");
  await page.locator("[data-fila-candidato]").filter({ hasText: "Nico Díaz" }).getByRole("button", { name: "Elegir a Nico Díaz" }).click();
  await expect(page.getByTestId("oido-elegido")).toContainText("Ya le avisamos: falta que confirme.");
});

test("si ya tomó otro turno en ese horario (409), se muestra el mensaje y la lista se recarga", async ({ page }) => {
  const c = await candidatos(page, [LUCAS, NICO], { status: 409, body: { detail: "Esta persona ya tomó otro turno en ese horario. Elegí a otra." } });
  await page.goto("/shifts/shift-1/candidates");
  await expect.poll(() => c.lista).toBeGreaterThanOrEqual(1);
  const antes = c.lista;
  await page.getByRole("button", { name: "Aceptar a Lucas" }).click();
  await expect(page.getByText("Esta persona ya tomó otro turno en ese horario. Elegí a otra.")).toBeVisible();
  await expect.poll(() => c.lista).toBeGreaterThan(antes);
  await expect(page.getByTestId("oido-elegido")).toHaveCount(0);
});
