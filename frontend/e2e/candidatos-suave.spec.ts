import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, isoEnDias, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

/**
 * Candidatos y el «¡Oído!» al elegir, con la dirección suave (2026-11-20,
 * ADR-0028, docs/historial/2026-11-20-candidatos-y-oido-direccion-suave.md):
 * un cielo corto con el título, la persona destacada como tarjeta (su foto
 * con el nombre encima; sin foto, el cielo hondo con sus iniciales y sus
 * datos), «Elegir a <nombre>» como único ámbar y los demás en filas. Al
 * elegir, «¡Oído!» a pantalla completa.
 */
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const EMPLOYER = { id: "user-1", email: "c@oido.test", full_name: "Julieta Demo", role: "employer", status: "activo", is_active: true, is_verified: true };
const persona = (id: string, nombre: string, extra: Record<string, unknown> = {}) => ({
  application_id: `app-${id}`, worker_profile_id: `wp-${id}`, full_name: nombre, photo_url: null, rating: 4.6, is_available: true,
  status: "pendiente", created_at: "2026-11-10T12:00:00-03:00", events_completed: 8, punctuality_rate: 0.92, years_experience: 2,
  badges: [], level: "bronce", identidad_verificada: false, ...extra,
});
const SHIFT = {
  id: "shift-1", company_id: "c1", position: "mozo", quantity: 1, start_at: isoEnDias(0, "21:00"), end_at: isoEnDias(1, "02:00"),
  pay_amount: "20000", currency: "ARS", tips: true, dress_code: null, urgent: false, address: null, city: "Palermo", latitude: null, longitude: null,
  title: null, description: null, status: "publicado", worker_profile_id: null, created_at: "2026-11-01T12:00:00-03:00", company_name: "Bar Lavalle", company_logo_url: null,
};
const SOFIA = persona("1", "Sofía Ramírez", { rating: 4.9, events_completed: 38, identidad_verificada: true });

async function candidatos(page: Page, postulantes: unknown[] = [SOFIA, persona("2", "Lucas Medina")]) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json(EMPLOYER)));
  await page.route("**/api/v1/shifts/shift-1", (r) => r.fulfill(json(SHIFT)));
  await page.route("**/api/v1/applications/shifts/shift-1", (r) => r.fulfill(json(postulantes)));
  await page.route("**/api/v1/shifts/shift-1/candidates", (r) =>
    r.fulfill(json([
      { profile_id: "wp-9", full_name: "Mateo Sugerido", photo_url: null, rating: 4.8, distance_km: 0.8, score: 0.91, events_completed: 23, punctuality_rate: 0.96, years_experience: 0 },
      { profile_id: "wp-8", full_name: "Ana Torres", photo_url: null, rating: 4.4, distance_km: 2.1, score: 0.7, events_completed: 0, punctuality_rate: 0, years_experience: 0 },
    ]))
  );
}

test("cielo corto con el título y el turno; la destacada sin foto va en el cielo hondo con sus datos", async ({ page }) => {
  await candidatos(page);
  await page.goto("/shifts/shift-1/candidates");
  await expect(page.getByRole("heading", { level: 1, name: "Se postularon 2" })).toBeVisible();
  await expect(page.getByTestId("candidatos-turno")).toHaveText("Mozo/a · Hoy, 21:00 – 02:00");
  await expect(page.getByRole("link", { name: "Volver al panel" })).toHaveAttribute("href", "/shifts");

  const destacada = page.locator("[data-destacado]");
  await expect(destacada).toHaveCount(1);
  await expect(destacada).toHaveClass(/tarjeta-destacada/);
  await expect(destacada).toContainText("Mejor calificación");
  await expect(destacada.getByRole("link", { name: "Sofía Ramírez" })).toHaveAttribute("href", "/workers/wp-1");
  await expect(destacada.locator("[data-sin-foto]")).toHaveText("S");
  await expect(destacada).toContainText("Identidad verificada");
  await expect(destacada.locator("dl")).toContainText("4,9");
  await expect(destacada.locator("dl")).toContainText("turnos hechos38");
  // La letra blanca va sobre el azul hondo (no sobre el celeste).
  expect(await destacada.locator(".cielo-hondo").evaluate((el) => getComputedStyle(el).color)).toBe("rgb(255, 255, 255)");

  // Los demás, en filas, bajo su título.
  await expect(page.getByRole("heading", { level: 2, name: "También se postularon" })).toBeVisible();
  const fila = page.locator("[data-fila-candidato]");
  await expect(fila).toHaveCount(1);
  await expect(fila).toContainText("Lucas Medina");
  await expect(fila).toContainText("Disponible · Calificación 4,6 · 8 turnos · 92% puntual · 2 años exp.");
});

test("un solo ámbar: «Elegir a <nombre>» en la destacada; en las filas, «Elegir» quieto", async ({ page }) => {
  await candidatos(page, [SOFIA, persona("2", "Lucas Medina"), persona("3", "Ana Paz")]);
  await page.goto("/shifts/shift-1/candidates");
  const principal = page.getByRole("button", { name: "Elegir a Sofía", exact: true });
  await expect(principal).toBeVisible();
  await expect(page.locator("button.boton-relieve")).toHaveCount(1);
  await expect(principal).toHaveClass(/boton-relieve/);
  const quietos = page.locator("[data-fila-candidato] button");
  await expect(quietos).toHaveCount(2);
  await expect(quietos.first()).toHaveAccessibleName("Elegir a Lucas Medina");
  await expect(quietos.first()).not.toHaveClass(/boton-relieve/);
});

test("con foto, la tarjeta es la foto con el nombre encima y el botón debajo", async ({ page }) => {
  await candidatos(page, [persona("1", "Julia Méndez", { photo_url: "/landing/cocinera.webp", rating: 4.9, events_completed: 41 })]);
  await page.goto("/shifts/shift-1/candidates");
  await expect(page.getByRole("heading", { level: 1, name: "Se postuló 1" })).toBeVisible();
  const destacada = page.locator("[data-destacado]");
  await expect(destacada.getByRole("img", { name: "Foto de Julia Méndez" })).toBeVisible();
  await expect(destacada.getByRole("link", { name: "Julia Méndez" })).toBeVisible();
  await expect(destacada).toContainText("41 turnos");
  const foto = await destacada.locator(".foto-destacada").boundingBox();
  const boton = await page.getByRole("button", { name: "Elegir a Julia" }).boundingBox();
  expect(boton!.y).toBeGreaterThanOrEqual(foto!.y + foto!.height);
  // Sin nadie más, no hay título de «los demás».
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
});

test("sin turnos hechos va primero igual, sin rótulo: no se inventa un motivo", async ({ page }) => {
  await candidatos(page, [persona("1", "Nadia Nueva", { rating: 0, events_completed: 0, punctuality_rate: 0, years_experience: 0 })]);
  await page.goto("/shifts/shift-1/candidates");
  const destacada = page.locator("[data-destacado]");
  await expect(destacada).toContainText("Nadia Nueva");
  await expect(destacada).not.toContainText("Mejor calificación");
  await expect(destacada).toContainText("Nuevo en Oído");
  await expect(destacada.locator("dl")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Elegir a Nadia" })).toBeVisible();
});

test("en Recomendados, el primero es la «Recomendación de Oído» y los demás van en filas, también de noche", async ({ page }) => {
  await setTheme(page, "dark");
  await candidatos(page);
  await page.goto("/shifts/shift-1/candidates");
  await page.getByRole("button", { name: /Recomendados/ }).click();
  const destacada = page.locator("[data-destacado]");
  await expect(destacada).toHaveCount(1);
  await expect(destacada).toContainText("Recomendación de Oído");
  await expect(destacada).toContainText("Mateo Sugerido");
  await expect(destacada.locator("dl")).toContainText("de tu local800 m");
  await expect(page.getByRole("heading", { level: 2, name: "También te recomendamos" })).toBeVisible();
  await expect(page.locator("[data-fila-candidato]")).toContainText("Ana Torres");
  await expect(page.locator("button.boton-relieve")).toHaveCount(1);
});

test("al elegir aparece «¡Oído!»: dice que falta que confirme y lleva al chat o al panel", async ({ page }) => {
  await candidatos(page);
  let pedido: unknown = null;
  await page.route("**/api/v1/shifts/shift-1/assign", (r) => {
    pedido = r.request().postDataJSON();
    return r.fulfill(json({ ...SHIFT, status: "asignado", worker_profile_id: "wp-1" }));
  });
  await page.goto("/shifts/shift-1/candidates");
  await page.getByRole("button", { name: "Elegir a Sofía", exact: true }).click();

  const oido = page.getByRole("dialog", { name: "¡Oído! Elegiste a Sofía" });
  await expect(oido).toBeVisible();
  expect(pedido).toEqual({ worker_profile_id: "wp-1" });
  await expect(oido).toContainText("Mozo/a, hoy a las 21:00. Ya le avisamos: falta que confirme.");
  await expect(oido.getByRole("link", { name: "Escribirle a Sofía" })).toHaveAttribute("href", "/chats/shift-1");
  await expect(oido.getByRole("link", { name: "Volver al panel", exact: true })).toHaveAttribute("href", "/shifts");
  // Sin fotos: las iniciales del local y de la persona.
  await expect(oido.getByRole("img", { name: "Bar Lavalle" })).toHaveText("BL");
  await expect(oido.getByRole("img", { name: "Sofía Ramírez" })).toHaveText("SR");
  // La cinta la dibuja Filete.tsx (un SVG), cae como un sello y las fotos llegan de los costados.
  await expect(oido.locator(".oido-sello svg")).toBeVisible();
  expect(await oido.locator(".oido-sello").evaluate((el) => getComputedStyle(el).animationName)).toBe("oidoSello");
  expect(await oido.locator(".oido-llega-izq").evaluate((el) => getComputedStyle(el).animationName)).toBe("oidoLlegaIzq");
  // Tapa toda la pantalla y el foco queda adentro.
  const caja = await oido.boundingBox();
  expect(caja).toEqual({ x: 0, y: 0, width: 390, height: 844 });
  expect(await oido.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  // Escape vuelve al panel.
  await page.route("**/api/v1/shifts/me**", (r) => r.fulfill(json([])));
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/shifts$/);
});

test("«¡Oído!» con «reducir movimiento»: nada se anima y entra todo en un celular chico", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 568 });
  await candidatos(page);
  await page.route("**/api/v1/shifts/shift-1/assign", (r) => r.fulfill(json({ ...SHIFT, status: "asignado" })));
  await page.goto("/shifts/shift-1/candidates");
  await page.getByRole("button", { name: "Elegir a Sofía", exact: true }).click();
  const oido = page.getByTestId("oido-elegido");
  await expect(oido).toBeVisible();
  for (const pieza of [".oido-sello", ".oido-llega-izq", ".oido-llega-der"]) {
    expect(await oido.locator(pieza).evaluate((el) => getComputedStyle(el).animationName), pieza).toBe("none");
  }
  // Las nubes tampoco derivan.
  expect(await oido.locator(".nube-cielo").first().evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  // Sin scroll horizontal, y las dos salidas se alcanzan.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await oido.getByRole("link", { name: "Volver al panel", exact: true }).scrollIntoViewIfNeeded();
  await expect(oido.getByRole("link", { name: "Escribirle a Sofía" })).toBeInViewport();
});

test("con la letra al 200 % a 320 px el nombre no queda en una columna de una letra, y «Elegir» mide 44 px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await candidatos(page, [persona("1", "Maximiliano Fernández", { rating: 4.9, events_completed: 38 }), persona("2", "Madonna")]);
  await page.goto("/shifts/shift-1/candidates");
  await expect(page.locator("[data-fila-candidato]")).toHaveCount(1);
  const alto = await page.locator("[data-fila-candidato] button").evaluate((el) => el.getBoundingClientRect().height);
  expect(alto).toBeGreaterThanOrEqual(44);

  await page.addStyleTag({ content: "html{font-size:200%}" });
  const m = await page.evaluate(() => {
    const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
    return {
      nombreFila: r("[data-fila-candidato] [data-nombre-candidato]").width,
      fila: r("[data-fila-candidato]"),
      boton: r("[data-fila-candidato] button"),
      nombreDestacada: r("[data-destacado] [data-nombre-candidato]").width,
      destacada: r("[data-destacado]"),
    };
  });
  // «Madonna» entra entera en su renglón y el botón baja al siguiente.
  expect(m.nombreFila).toBeGreaterThan(100);
  expect(m.boton.right).toBeLessThanOrEqual(m.fila.right);
  expect(m.fila.right).toBeLessThanOrEqual(320);
  expect(m.nombreDestacada).toBeGreaterThan(150);
  expect(m.destacada.right).toBeLessThanOrEqual(320);
});

test("sobre la foto el nombre ocupa a lo sumo dos renglones", async ({ page }) => {
  await candidatos(page, [
    persona("1", "Maximiliano Alejandro Fernandez de la Cruz Sanchez Villa", { photo_url: "/landing/cocinera.webp", events_completed: 41 }),
  ]);
  await page.goto("/shifts/shift-1/candidates");
  const nombre = page.locator("[data-destacado] [data-nombre-candidato]");
  await expect(nombre).toBeVisible();
  const { alto, renglon } = await nombre.evaluate((el) => ({
    alto: el.getBoundingClientRect().height,
    renglon: parseFloat(getComputedStyle(el).lineHeight),
  }));
  expect(alto).toBeLessThanOrEqual(renglon * 2 + 1);
  await expect(nombre).toHaveAttribute("title", "Maximiliano Alejandro Fernandez de la Cruz Sanchez Villa");
});

test("el foco por teclado sobre la destacada lleva contorno blanco, con foto y sin foto", async ({ page }) => {
  for (const extra of [{}, { photo_url: "/landing/cocinera.webp" }]) {
    await candidatos(page, [persona("1", "Julia Méndez", { events_completed: 41, ...extra })]);
    await setTheme(page, "light");
    await page.goto("/shifts/shift-1/candidates");
    const link = page.locator("[data-destacado]").getByRole("link", { name: "Julia Méndez" });
    await expect(link).toBeVisible();
    for (let i = 0; i < 12 && !(await link.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
    await expect(link).toBeFocused();
    const { color, estilo } = await link.evaluate((el) => {
      const c = getComputedStyle(el);
      return { color: c.outlineColor, estilo: c.outlineStyle };
    });
    expect(color).toBe("rgb(255, 255, 255)");
    expect(estilo).not.toBe("none");
    await page.unrouteAll({ behavior: "ignoreErrors" });
  }
});

test("«¡Oído!» sin nombre del local: no hay un «El local» vacío para el lector de pantalla", async ({ page }) => {
  await candidatos(page);
  await page.route("**/api/v1/shifts/shift-1", (r) => r.fulfill(json({ ...SHIFT, company_name: null })));
  await page.route("**/api/v1/shifts/shift-1/assign", (r) => r.fulfill(json({ ...SHIFT, company_name: null, status: "asignado", worker_profile_id: "wp-1" })));
  await page.goto("/shifts/shift-1/candidates");
  await page.getByRole("button", { name: "Elegir a Sofía", exact: true }).click();
  const oido = page.getByRole("dialog", { name: "¡Oído! Elegiste a Sofía" });
  await expect(oido).toBeVisible();
  await expect(oido.getByRole("img", { name: "El local" })).toHaveCount(0);
  await expect(oido.getByRole("img", { name: "Sofía Ramírez" })).toHaveText("SR");
});

test("las cifras de la destacada no se pisan con la letra al 200 % a 320 px, y a 390 px van en un renglón", async ({ page }) => {
  await candidatos(page, [persona("1", "Sofía Ramírez", { rating: 4.9, events_completed: 38 })]);
  const medir = () =>
    page.evaluate(() => ({
      cajas: [...document.querySelectorAll("[data-destacado] dl > div")].map((e) => {
        const r = e.getBoundingClientRect();
        return { top: r.top, left: r.left, right: r.right, bottom: r.bottom };
      }),
      rotulos: [...document.querySelectorAll("[data-destacado] dt")].map((e) => e.scrollWidth - e.clientWidth),
    }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/shifts/shift-1/candidates");
  await expect(page.locator("[data-destacado] dl > div")).toHaveCount(3);
  const normal = await medir();
  expect(new Set(normal.cajas.map((c) => Math.round(c.top))).size).toBe(1);

  await page.setViewportSize({ width: 320, height: 800 });
  await page.addStyleTag({ content: "html{font-size:200%}" });
  const grande = await medir();
  for (let i = 0; i < grande.cajas.length; i++) {
    for (let j = i + 1; j < grande.cajas.length; j++) {
      const a = grande.cajas[i], b = grande.cajas[j];
      const seSuperponen = a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
      expect(seSuperponen).toBe(false);
    }
  }
  for (const sobra of grande.rotulos) expect(sobra).toBeLessThanOrEqual(0);
});

// Escritorio, renglón 2 (2026-11-24): en la compu la lista y la ficha de la
// persona elegida van lado a lado; «Elegir a <nombre>» vive en la ficha (el
// único ámbar) y tocar a otra persona cambia la ficha sin salir de la pantalla.
test.describe("en la compu, la lista con la ficha al lado", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const PERFIL = (id: string, nombre: string) => ({
    id, user_id: `u-${id}`, full_name: nombre, photo_url: null, birth_date: null, age: 27, city: "Palermo, CABA",
    bio: `Bio de ${nombre}.`, latitude: null, longitude: null, skills: ["mozo"], years_experience: 7, languages: [], certifications: [],
    cv_url: null, cv_filename: null, cv_kind: null, is_available: true, rating: 4.8, events_completed: 38, punctuality_rate: 0.95,
    cancellations: 0, level: "plata", badges: [], identidad_verificada: true,
  });

  async function conFichas(page: Page) {
    await candidatos(page, [SOFIA, persona("2", "Lucas Medina"), persona("3", "Ana Paz")]);
    const nombres: Record<string, string> = { "wp-1": "Sofía Ramírez", "wp-2": "Lucas Medina", "wp-3": "Ana Paz" };
    await page.route(/\/api\/v1\/workers\/wp-\d+$/, (r) => {
      const id = r.request().url().split("/").pop()!;
      return r.fulfill(json(PERFIL(id, nombres[id])));
    });
    await page.route(/\/api\/v1\/favorites\/wp-\d+\/status/, (r) => r.fulfill(json({ is_favorite: false })));
    await page.route("**/api/v1/reviews/workers/**", (r) => r.fulfill(json([])));
  }

  test("la ficha de la primera persona queda a la derecha de la lista, con un solo ámbar", async ({ page }) => {
    await conFichas(page);
    await page.goto("/shifts/shift-1/candidates");
    const ficha = page.getByTestId("ficha-candidato");
    await expect(ficha).toBeVisible();
    await expect(ficha.getByRole("heading", { level: 2, name: "Sofía Ramírez, 27" })).toBeVisible();
    await expect(ficha).toContainText("Bio de Sofía Ramírez.");
    // Sin tarjeta destacada: todos en filas; la primera con su rótulo.
    await expect(page.locator("[data-destacado]")).toHaveCount(0);
    const filas = page.locator("[data-fila-candidato]");
    await expect(filas).toHaveCount(3);
    await expect(filas.first()).toContainText("Mejor calificación");
    // Lista a la izquierda, ficha a la derecha, a la misma altura de arriba.
    const lista = (await filas.first().boundingBox())!;
    const caja = (await ficha.boundingBox())!;
    expect(caja.x).toBeGreaterThan(lista.x + lista.width);
    expect(Math.abs(caja.y - lista.y)).toBeLessThan(120);
    expect(lista.width).toBeLessThan(480);
    // El único ámbar es «Elegir a Sofía», en la ficha.
    await expect(page.locator("button.boton-relieve")).toHaveCount(1);
    await expect(ficha.getByRole("button", { name: "Elegir a Sofía", exact: true })).toHaveClass(/boton-relieve/);
  });

  test("tocar a otra persona cambia la ficha sin salir de la pantalla; elegirla asigna a esa persona", async ({ page }) => {
    await conFichas(page);
    let asignado: unknown = null;
    await page.route("**/api/v1/shifts/shift-1/assign", (r) => {
      asignado = r.request().postDataJSON();
      return r.fulfill(json({ ...SHIFT, status: "asignado", worker_profile_id: "wp-2" }));
    });
    await page.goto("/shifts/shift-1/candidates");
    await page.locator("[data-fila-candidato]").filter({ hasText: "Lucas Medina" }).getByRole("link").click();
    await expect(page).toHaveURL(/\/shifts\/shift-1\/candidates/);
    const ficha = page.getByTestId("ficha-candidato");
    await expect(ficha.getByRole("heading", { level: 2, name: "Lucas Medina, 27" })).toBeVisible();
    await expect(ficha).toContainText("Bio de Lucas Medina.");
    await expect(ficha.getByRole("link", { name: "Ver ficha completa" })).toHaveAttribute("href", "/workers/wp-2");
    await ficha.getByRole("button", { name: "Elegir a Lucas", exact: true }).click();
    await expect.poll(() => asignado).toEqual({ worker_profile_id: "wp-2" });
  });

  test("en el celular no hay ficha al lado y la destacada sigue donde estaba", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await conFichas(page);
    await page.goto("/shifts/shift-1/candidates");
    await expect(page.locator("[data-destacado]")).toHaveCount(1);
    await expect(page.getByTestId("ficha-candidato")).toHaveCount(0);
  });
});
