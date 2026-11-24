import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";
import { deContrato } from "./contrato";

/**
 * Las fichas públicas con la dirección suave (ADR-0028, 2026-11-21,
 * docs/historial/2026-11-21-fichas-direccion-suave.md): `/workers/[id]` y
 * `/companies/[id]` son lo que cada persona ve en su propio perfil, visto desde
 * afuera. Sólo cambia la piel: se ve lo mismo que antes según el rol (el CV sólo
 * con `cv_kind`, «Favorito» sólo para el comercio, «Reportar un problema» sólo
 * para quien trabaja) y no hay ámbar. Se mide renderizado, en claro y de noche.
 */
const json = (body: unknown, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const AMBAR = /rgb\(246, 169, 42\)|rgb\(229, 142, 15\)|rgb\(245, 158, 11\)|rgb\(217, 119, 6\)|rgb\(255, 171, 37\)|rgb\(251, 191, 36\)/;
const FOTO = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#6fa8c8"/></svg>');

const TRABAJADORA = {
  id: "wp-1",
  user_id: "u-9",
  full_name: "Vera Mozo",
  photo_url: FOTO,
  birth_date: null,
  age: 29,
  city: "Palermo, CABA",
  bio: "Seis años en salón y barra. Me gusta el servicio rápido y prolijo.",
  latitude: null,
  longitude: null,
  skills: ["mozo", "bartender"],
  years_experience: 6,
  languages: ["Español", "Inglés"],
  certifications: ["Manipulación de alimentos"],
  cv_url: null,
  cv_filename: null,
  cv_kind: null,
  is_available: true,
  rating: 4.6,
  events_completed: 12,
  punctuality_rate: 0.95,
  cancellations: 1,
  no_shows: 0,
  badges: ["puntual"],
  level: "plata",
  identidad_verificada: true,
};
const TRABAJADORA_MINIMA = {
  ...TRABAJADORA,
  id: "wp-2",
  full_name: "Nico Nuevo",
  photo_url: null,
  age: null,
  city: null,
  bio: null,
  skills: [],
  years_experience: 0,
  languages: [],
  certifications: [],
  rating: 0,
  events_completed: 0,
  punctuality_rate: 0,
  cancellations: 0,
  badges: [],
  level: "bronce",
  is_available: false,
  identidad_verificada: false,
};
const COMERCIO = {
  id: "c-1",
  user_id: "u-7",
  owner_full_name: "Julieta Demo",
  name: "Bar Lavalle",
  logo_url: FOTO,
  cover_photo_url: FOTO,
  category: "bar",
  description: "Bar de barrio con música en vivo los jueves.",
  address: "Lavalle 1234, CABA",
  city: "Palermo, CABA",
  latitude: -34.6,
  longitude: -58.43,
  capacity: 80,
  opening_hours: "Lun a sáb de 18 a 2",
  rating: 4.7,
  events_published: 23,
  on_time_payment_rate: 0.96,
  payments_recorded: 18,
  late_cancellations: 1,
};
const COMERCIO_MINIMO = {
  ...COMERCIO,
  id: "c-2",
  name: "Café Nuevo",
  logo_url: null,
  cover_photo_url: null,
  category: null,
  description: null,
  address: null,
  city: null,
  latitude: null,
  longitude: null,
  capacity: null,
  opening_hours: null,
  owner_full_name: null,
  rating: 0,
  events_published: 0,
  on_time_payment_rate: 0,
  payments_recorded: 0,
};
const RESENAS = [
  { id: "r1", shift_id: "s1", reviewer_user_id: "x", reviewee_user_id: "u-9", rating: 5, comment: "Impecable, llegó antes y se quedó hasta el final.", created_at: "2026-11-10T12:00:00-03:00" },
  { id: "r2", shift_id: "s2", reviewer_user_id: "y", reviewee_user_id: "u-9", rating: 4, comment: null, created_at: "2026-10-01T12:00:00-03:00" },
];

type Opciones = {
  tema?: "light" | "dark";
  rol?: "employer" | "worker";
  ancho?: number;
  alto?: number;
  trabajador?: Record<string, unknown>;
  comercio?: Record<string, unknown>;
  favorito?: boolean;
  resenas?: unknown[];
  fallaCarga?: boolean;
  lenta?: boolean;
};

const pedidos: string[] = [];

async function preparar(page: Page, o: Opciones = {}) {
  const tema = o.tema ?? "light";
  pedidos.length = 0;
  await page.setViewportSize({ width: o.ancho ?? 390, height: o.alto ?? 844 });
  await setTheme(page, tema);
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await page.route("**/api/v1/**", (r) => (r.request().method() === "GET" ? r.fulfill(json([])) : r.continue()));
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) =>
    r.fulfill(json(deContrato(o.rol === "worker" ? "auth_me_worker" : "auth_me_employer", {})))
  );
  await page.route("**/rota.test/**", (r) => r.abort());
  let favorito = o.favorito ?? false;
  await page.route("**/api/v1/favorites/**", (r) => {
    const req = r.request();
    pedidos.push(`${req.method()} ${new URL(req.url()).pathname}`);
    if (req.method() === "PUT") favorito = true;
    if (req.method() === "DELETE") favorito = false;
    return r.fulfill(json({ is_favorite: favorito }));
  });
  await page.route("**/api/v1/reviews/workers/*", (r) => r.fulfill(json(o.resenas ?? RESENAS)));
  const demora = () => (o.lenta ? new Promise((ok) => setTimeout(ok, 2500)) : Promise.resolve());
  await page.route("**/api/v1/workers/wp-*", async (r) => {
    await demora();
    return o.fallaCarga ? r.fulfill(json({ detail: "No encontramos a esa persona" }, 404)) : r.fulfill(json(o.trabajador ?? TRABAJADORA));
  });
  await page.route("**/api/v1/companies/c-*", async (r) => {
    await demora();
    return o.fallaCarga ? r.fulfill(json({ detail: "No encontramos ese comercio" }, 404)) : r.fulfill(json(o.comercio ?? COMERCIO));
  });
}

async function abrir(page: Page, ruta: string, o: Opciones = {}) {
  await preparar(page, o);
  await page.goto(ruta);
  await expect(page.locator("html")).toHaveAttribute("data-theme", o.tema ?? "light");
}

/** Cuántos elementos a la vista están pintados de ámbar. */
async function ambares(page: Page) {
  return page.evaluate((fuente) => {
    const ambar = new RegExp(fuente);
    return [...document.querySelectorAll<HTMLElement>("main *, .estilo-suave *")].filter((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && (ambar.test(cs.backgroundColor) || ambar.test(cs.backgroundImage) || ambar.test(cs.color));
    }).length;
  }, AMBAR.source);
}

const sinScrollHorizontal = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

const hoja = (page: Page) => page.locator(".hoja");

for (const tema of ["light", "dark"] as const) {
  test(`${tema}: ficha de quien trabaja, vista por un comercio: nombre y edad en el cielo, foto a caballo, reputación en grande, sin ámbar`, async ({ page }) => {
    await abrir(page, "/workers/wp-1", { tema });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Vera Mozo, 29");
    await expect(page.locator(".app-cielo")).toContainText("Palermo, CABA");
    await expect(page.locator(".app-cielo .titulo-pantalla")).toHaveText("Vera Mozo, 29");
    await expect(page.locator(".perfil-foto img")).toBeVisible();
    await expect(hoja(page).locator(".chip-suave", { hasText: "Identidad verificada" })).toBeVisible();
    await expect(page.locator(".perfil-numero")).toHaveText(/4,6/);
    await expect(hoja(page)).toContainText("12 turnos hechos · puntualidad 95%");
    await expect(hoja(page).locator("ul .chip-suave", { hasText: "Mozo/a" })).toBeVisible();
    await expect(hoja(page).locator("ul .chip-suave", { hasText: "Bartender" })).toBeVisible();
    await expect(hoja(page)).toContainText("Seis años en salón y barra.");
    const filas = page.locator("dl.perfil-filas");
    await expect(filas).toContainText("Experiencia");
    await expect(filas).toContainText("6 años");
    await expect(filas).toContainText("Nivel");
    await expect(filas).toContainText("Plata");
    await expect(filas).toContainText("Disponibilidad");
    await expect(filas).toContainText("Disponible");
    await expect(filas).toContainText("Idiomas");
    await expect(filas).toContainText("Español, Inglés");
    await expect(filas).toContainText("Certificaciones");
    await expect(filas).toContainText("Manipulación de alimentos");
    await expect(hoja(page).getByRole("heading", { name: "Insignias" })).toBeVisible();
    await expect(hoja(page).getByRole("heading", { name: "Reseñas" })).toBeVisible();
    await expect(hoja(page)).toContainText("Impecable, llegó antes y se quedó hasta el final.");
    // Lo que NO es de la ficha: lo propio de la persona (cancelaciones, ausencias, ganancias).
    await expect(page.locator("main")).not.toContainText(/Cancelaciones|Ausencias|Ganado/);
    // La nota y las reseñas no usan el ámbar (un solo ámbar por pantalla: acá, ninguno).
    expect(await ambares(page)).toBe(0);
    expect(await sinScrollHorizontal(page)).toBe(true);
  });

  test(`${tema}: ficha del comercio, vista por quien trabaja: logo a caballo, foto del local, reputación, datos y ubicación`, async ({ page }) => {
    await abrir(page, "/companies/c-1", { tema, rol: "worker" });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bar Lavalle");
    await expect(page.locator(".app-cielo")).toContainText("Bar · Palermo, CABA");
    await expect(page.locator(".perfil-foto img")).toBeVisible();
    await expect(hoja(page).locator(`img[alt="Bar Lavalle"]`)).toBeVisible();
    await expect(page.locator(".perfil-numero")).toHaveText(/4,7/);
    await expect(hoja(page)).toContainText("23 turnos publicados · pago a tiempo 96%");
    await expect(hoja(page)).toContainText("A cargo de Julieta Demo");
    await expect(hoja(page)).toContainText("Bar de barrio con música en vivo los jueves.");
    const filas = page.locator("dl.perfil-filas");
    await expect(filas).toContainText("Capacidad");
    await expect(filas).toContainText("80 personas");
    await expect(filas).toContainText("Horario");
    await expect(filas).toContainText("Lun a sáb de 18 a 2");
    await expect(filas).toContainText("Dirección");
    await expect(filas).toContainText("Lavalle 1234, CABA");
    await expect(hoja(page).getByRole("heading", { name: "Ubicación" })).toBeVisible();
    await expect(hoja(page).locator(".mapa-chico")).toBeVisible();
    await expect(hoja(page).getByRole("button", { name: "Cómo llegar" })).toHaveClass(/boton-hondo/);
    await expect(hoja(page).getByRole("link", { name: "Reportar un problema" })).toBeVisible();
    // Lo que no es de la ficha: lo propio del comercio.
    await expect(page.locator("main")).not.toContainText(/Verificación del comercio|Cancelaciones tardías|Mi plan/);
    expect(await ambares(page)).toBe(0);
    expect(await sinScrollHorizontal(page)).toBe(true);
  });
}

test("«Agregar a favoritos» es la acción del comercio: azul hondo; al tocarla pasa a «Favorito», quieta y con el corazón lleno", async ({ page }) => {
  await abrir(page, "/workers/wp-1");
  const agregar = page.getByRole("button", { name: "Agregar a favoritos" });
  await expect(agregar).toHaveAttribute("aria-pressed", "false");
  await expect(agregar).toHaveClass(/boton-hondo/);
  await expect.poll(() => agregar.evaluate((el) => getComputedStyle(el).backgroundImage)).toMatch(/linear-gradient/);
  await agregar.click();
  const favorito = page.getByRole("button", { name: "Favorito" });
  await expect(favorito).toHaveAttribute("aria-pressed", "true");
  await expect(favorito).toHaveClass(/boton-quieto/);
  await expect(favorito.locator("svg")).toBeVisible();
  expect(pedidos).toContain("PUT /api/v1/favorites/wp-1");
  // Y se saca.
  await favorito.click();
  await expect(page.getByRole("button", { name: "Agregar a favoritos" })).toHaveAttribute("aria-pressed", "false");
  expect(pedidos).toContain("DELETE /api/v1/favorites/wp-1");
});

test("si el favorito falla, vuelve atrás", async ({ page }) => {
  await preparar(page);
  await page.route("**/api/v1/favorites/wp-1", (r) =>
    r.request().method() === "PUT" ? r.fulfill(json({ detail: "x" }, 500)) : r.fulfill(json({ is_favorite: false }))
  );
  await page.goto("/workers/wp-1");
  await page.getByRole("button", { name: "Agregar a favoritos" }).click();
  await expect(page.getByRole("button", { name: "Agregar a favoritos" })).toHaveAttribute("aria-pressed", "false");
});

test("quien trabaja no ve «Favorito» ni pide el estado de favorito de otra persona", async ({ page }) => {
  await abrir(page, "/workers/wp-1", { rol: "worker" });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Vera Mozo, 29");
  await expect(page.getByRole("button", { name: /favorito/i })).toHaveCount(0);
  expect(pedidos).toEqual([]);
});

test("el CV sólo aparece si llega «cv_kind»: «Ver CV» y «Descargar» quietos; un link no se descarga", async ({ page }) => {
  await abrir(page, "/workers/wp-1", { trabajador: { ...TRABAJADORA, cv_kind: "file" } });
  await expect(page.getByRole("button", { name: "Ver CV" })).toHaveClass(/boton-quieto/);
  await expect(page.getByRole("button", { name: "Descargar" })).toHaveClass(/boton-quieto/);
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await abrir(page, "/workers/wp-1", { trabajador: { ...TRABAJADORA, cv_kind: "link" } });
  await expect(page.getByRole("button", { name: "Ver CV" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Descargar" })).toHaveCount(0);
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await abrir(page, "/workers/wp-1", { trabajador: { ...TRABAJADORA, cv_kind: null } });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Vera Mozo, 29");
  await expect(page.getByRole("button", { name: "Ver CV" })).toHaveCount(0);
});

test("«Reportar un problema» no lo ve el comercio", async ({ page }) => {
  await abrir(page, "/companies/c-1", { rol: "employer" });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bar Lavalle");
  await expect(page.getByRole("link", { name: "Reportar un problema" })).toHaveCount(0);
});

test("«Reportar un problema» lo ve quien trabaja, y lleva a Soporte con el comercio", async ({ page }) => {
  await abrir(page, "/companies/c-1", { rol: "worker" });
  await expect(page.getByRole("link", { name: "Reportar un problema" })).toHaveAttribute("href", /\/support\?categoria=comercio&comercio=c-1/);
});

test("«Cómo llegar» abre las indicaciones del local", async ({ page }) => {
  await abrir(page, "/companies/c-1", { rol: "worker" });
  const [pestana] = await Promise.all([page.waitForEvent("popup"), page.getByRole("button", { name: "Cómo llegar" }).click()]);
  expect(pestana.url()).toContain("destination=-34.6,-58.43");
});

test("perfil mínimo de quien trabaja: sin foto la inicial, «Nuevo en Oído», sin ceros ni filas vacías", async ({ page }) => {
  await abrir(page, "/workers/wp-2", { trabajador: TRABAJADORA_MINIMA, resenas: [] });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nico Nuevo");
  await expect(page.locator(".perfil-foto img:not(.portada-nube)")).toHaveCount(0);
  // Sin foto: el cielo de `SinFoto` (degradé con nube e inicial), no un color liso.
  await expect(page.locator(".perfil-foto [data-sin-foto='nube'] img.portada-nube")).toHaveCount(1);
  await expect(page.locator(".perfil-foto")).toHaveText("N");
  await expect(hoja(page)).toContainText("Nuevo en Oído");
  await expect(page.locator(".perfil-numero")).toHaveCount(0);
  await expect(page.getByRole("img", { name: /estrellas/ })).toHaveCount(0);
  await expect(hoja(page).getByText(/puntualidad/i)).toHaveCount(0);
  await expect(hoja(page).locator(".chip-suave")).toHaveCount(0);
  await expect(hoja(page)).not.toContainText(/Idiomas|Certificaciones|Insignias/);
  await expect(hoja(page).getByText("Todavía no tiene reseñas.")).toBeVisible();
  await expect(hoja(page).getByText("No disponible")).toBeVisible();
  expect((await page.locator("main").innerText())).not.toMatch(/0[.,]0\b/);
  expect(await ambares(page)).toBe(0);
});

test("perfil mínimo del comercio: sin logo la inicial, sin foto, sin mapa, sin nota ni pagos", async ({ page }) => {
  await abrir(page, "/companies/c-2", { comercio: COMERCIO_MINIMO, rol: "worker" });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Café Nuevo");
  await expect(page.locator(".perfil-foto")).toHaveText("C");
  await expect(hoja(page).locator("img:not(.portada-nube)")).toHaveCount(0);
  await expect(page.locator(".perfil-foto [data-sin-foto]")).toBeVisible();
  await expect(hoja(page)).toContainText("Nuevo en Oído");
  await expect(hoja(page)).not.toContainText(/Pago a tiempo|A cargo|Ubicación|Capacidad|Horario|Dirección/i);
  await expect(page.locator("dl.perfil-filas")).toHaveCount(0);
  await expect(hoja(page).getByRole("button", { name: "Cómo llegar" })).toHaveCount(0);
  expect((await page.locator("main").innerText())).not.toMatch(/0[.,]0\b|\b0%/);
  await expect(hoja(page).getByRole("link", { name: "Reportar un problema" })).toBeVisible();
});

test("con turnos y sin nota: el número grande son los turnos; con turnos sin pagos no hay «pago a tiempo»", async ({ page }) => {
  await abrir(page, "/companies/c-1", { comercio: { ...COMERCIO, rating: 0, events_published: 3, payments_recorded: 0, on_time_payment_rate: 0 } });
  await expect(page.locator(".perfil-numero")).toHaveText("3");
  await expect(hoja(page).getByText("turnos publicados", { exact: true })).toBeVisible();
  await expect(hoja(page)).not.toContainText(/pago a tiempo/i);
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await abrir(page, "/workers/wp-1", { trabajador: { ...TRABAJADORA, rating: 0, events_completed: 1 }, resenas: [] });
  await expect(page.locator(".perfil-numero")).toHaveText("1");
  await expect(hoja(page).getByText("turno hecho", { exact: true })).toBeVisible();
  await expect(hoja(page)).toContainText("puntualidad 95%");
  await expect(page.getByRole("img", { name: /estrellas/ })).toHaveCount(0);
});

test("una foto o un logo que no carga vuelve a la inicial; la foto del local rota se esconde", async ({ page }) => {
  await abrir(page, "/workers/wp-1", { trabajador: { ...TRABAJADORA, photo_url: "https://rota.test/a.jpg" } });
  await expect(page.locator(".perfil-foto")).toHaveText("V");
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await abrir(page, "/companies/c-1", { comercio: { ...COMERCIO, logo_url: "https://rota.test/l.jpg", cover_photo_url: "https://rota.test/c.jpg" } });
  await expect(page.locator(".perfil-foto")).toHaveText("B");
  await expect(hoja(page).locator("img:not(.portada-nube)")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bar Lavalle");
});

test("carga: el cielo lleva una barra (no cambia de texto) y la hoja un esqueleto con la forma nueva", async ({ page }) => {
  await preparar(page, { lenta: true });
  await page.goto("/workers/wp-1");
  await expect(page.locator(".app-cielo .animate-pulse")).toBeVisible();
  await expect(page.locator(".titulo-pantalla")).toHaveCount(0);
  await expect(hoja(page).locator(".animate-pulse").first()).toBeVisible();
  await expect(page.locator(".perfil-foto")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Vera Mozo, 29", { timeout: 10_000 });
});

test("error de carga: el mensaje, «Reintentar» y «Volver», con la hoja y el cielo", async ({ page }) => {
  await abrir(page, "/companies/c-1", { fallaCarga: true });
  await expect(hoja(page).getByText("No encontramos ese comercio")).toBeVisible();
  await expect(hoja(page).getByRole("button", { name: "Volver" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Volver" })).toHaveCount(1);
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await abrir(page, "/workers/wp-1", { fallaCarga: true });
  await expect(hoja(page).getByText("No encontramos a esa persona")).toBeVisible();
  await expect(page.getByRole("button", { name: "Volver" })).toHaveCount(1);
});

for (const ruta of ["/workers/wp-1", "/companies/c-1"]) {
  test(`${ruta}: «Volver» del cielo, sin historial, lleva a Buscar`, async ({ page }) => {
    await preparar(page);
    await page.addInitScript(() => {
      Object.defineProperty(History.prototype, "length", { get: () => 1 });
    });
    await page.goto(ruta);
    await page.getByRole("button", { name: "Volver" }).click();
    await expect(page).toHaveURL(/\/search/);
  });
}

test("con historial, «Volver» retrocede", async ({ page }) => {
  await preparar(page);
  await page.goto("/");
  await page.goto("/workers/wp-1");
  await expect(page.getByRole("button", { name: "Volver" })).toBeVisible();
  await page.getByRole("button", { name: "Volver" }).click();
  await expect(page).not.toHaveURL(/\/workers\//);
});

for (const ancho of [320, 390]) {
  test(`${ancho} px: nombres, textos y direcciones largos no desbordan`, async ({ page }) => {
    const largo = "Bar y Restaurante de la Esquina de las Tres Avenidas Principales Sociedad Anónima";
    await abrir(page, "/companies/c-1", {
      ancho,
      comercio: {
        ...COMERCIO,
        name: largo,
        address: "Avenida Presidente Roque Sáenz Peña 1234, Piso 12, Oficina C, Ciudad Autónoma de Buenos Aires",
        opening_hours: "Lunes a viernes de 8 a 23, sábados y domingos de 10 a 3 de la mañana",
        owner_full_name: "Maximiliano Alejandro Fernández de la Torre y Ortiz",
        category: "empresa_gastronomica",
      },
    });
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Bar y Restaurante");
    expect(await sinScrollHorizontal(page)).toBe(true);
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await abrir(page, "/workers/wp-1", {
      ancho,
      trabajador: {
        ...TRABAJADORA,
        full_name: "María de los Ángeles Fernández de la Torre y Ortiz de Zárate",
        languages: ["Español", "Inglés", "Portugués", "Italiano", "Francés"],
        certifications: ["Manipulación de alimentos", "Coctelería profesional nivel 2", "Barista certificado"],
        bio: "Palabra".repeat(30),
      },
    });
    await expect(page.getByRole("heading", { level: 1 })).toContainText("María de los Ángeles");
    expect(await sinScrollHorizontal(page)).toBe(true);
  });
}

test("1280 px: las reseñas pasan a la columna de al lado, sobre la misma hoja", async ({ page }) => {
  await abrir(page, "/workers/wp-1", { ancho: 1280, alto: 900 });
  const principal = (await page.locator("dl.perfil-filas").boundingBox())!;
  const resenas = (await hoja(page).getByRole("heading", { name: "Reseñas" }).boundingBox())!;
  expect(resenas.x).toBeGreaterThan(principal.x + principal.width);
  expect(await sinScrollHorizontal(page)).toBe(true);
});

test("1280 px: la ubicación del comercio pasa a la columna de al lado", async ({ page }) => {
  await abrir(page, "/companies/c-1", { ancho: 1280, alto: 900, rol: "worker" });
  const datos = (await page.locator("dl.perfil-filas").boundingBox())!;
  const mapa = (await hoja(page).locator(".mapa-chico").boundingBox())!;
  expect(mapa.x).toBeGreaterThan(datos.x + datos.width);
  expect(await sinScrollHorizontal(page)).toBe(true);
});

test("el nombre se lee sobre el cielo y la letra sobre la marca no es blanca fija", async ({ page }) => {
  for (const tema of ["light", "dark"] as const) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await abrir(page, "/workers/wp-1", { tema });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Vera Mozo, 29");
    const clases = await page.evaluate(() => [...document.querySelectorAll(".estilo-suave *")].filter((el) => /(^|\s)text-white(\s|$)/.test(el.getAttribute("class") ?? "")).length);
    expect(clases).toBe(0);
  }
});

/** Letra al 200 % (WCAG 1.4.4): como si la persona subiera el tamaño del texto del navegador. */
async function letraGrande(page: Page) {
  await page.addStyleTag({ content: "html{font-size:200% !important}" });
  await page.waitForTimeout(300);
}

test("letra al 200 %: las filas envuelven sin pisarse, la reputación no se sale y no hay scroll horizontal", async ({ page }) => {
  await abrir(page, "/workers/wp-1", {
    trabajador: { ...TRABAJADORA, languages: ["Español", "Inglés", "Portugués"], certifications: ["Manipulación de alimentos", "Coctelería profesional"] },
  });
  await letraGrande(page);
  const filas = await page.locator("dl.perfil-filas > div").all();
  expect(filas.length).toBeGreaterThanOrEqual(5);
  for (const fila of filas) {
    const dt = (await fila.locator("dt").boundingBox())!;
    const dd = (await fila.locator("dd").boundingBox())!;
    const cruzan = dt.x < dd.x + dd.width && dd.x < dt.x + dt.width && dt.y < dd.y + dd.height && dd.y < dt.y + dt.height;
    expect(cruzan, `${await fila.innerText()}`).toBe(false);
  }
  // Ninguna palabra partida letra por letra: «Español» entero en su renglón.
  const alto = await page.locator("dl.perfil-filas dd", { hasText: "Español" }).evaluate((el) => el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight));
  expect(alto).toBeLessThan(4);
  const ancho = await page.evaluate(() => document.documentElement.clientWidth);
  const linea = (await hoja(page).getByText(/12 turnos hechos/).boundingBox())!;
  expect(linea.x + linea.width).toBeLessThanOrEqual(ancho);
  const favorito = (await page.getByRole("button", { name: "Agregar a favoritos" }).boundingBox())!;
  expect(favorito.x).toBeGreaterThanOrEqual(0);
  expect(favorito.x + favorito.width).toBeLessThanOrEqual(ancho);
  expect(await sinScrollHorizontal(page)).toBe(true);
});

test("letra al 200 %: la ficha del comercio tampoco se pisa", async ({ page }) => {
  await abrir(page, "/companies/c-1", { rol: "worker" });
  await letraGrande(page);
  for (const fila of await page.locator("dl.perfil-filas > div").all()) {
    const dt = (await fila.locator("dt").boundingBox())!;
    const dd = (await fila.locator("dd").boundingBox())!;
    expect(dt.y + dt.height <= dd.y + 1 || dd.x >= dt.x + dt.width || dt.x >= dd.x + dd.width, `${await fila.innerText()}`).toBe(true);
  }
  expect(await sinScrollHorizontal(page)).toBe(true);
});

test("un nombre larguísimo no se recorta: ocupa los renglones que necesite", async ({ page }) => {
  const nombre = "María de los Ángeles Fernández de la Torre y Ortiz de Zárate Villanueva Echeverría Pueyrredón";
  await abrir(page, "/workers/wp-1", { ancho: 320, trabajador: { ...TRABAJADORA, full_name: nombre } });
  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1).toHaveText(`${nombre}, 29`);
  const r = await h1.evaluate((el) => ({ clamp: getComputedStyle(el).webkitLineClamp, sobra: el.scrollHeight - el.clientHeight, renglones: el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight) }));
  expect(r.clamp).toBe("none");
  expect(r.sobra).toBeLessThanOrEqual(4); // los descendentes de una letra apretada, no un recorte
  expect(r.renglones).toBeGreaterThan(2.5);
  expect(await sinScrollHorizontal(page)).toBe(true);
});

test("comercio con pagos registrados y sin turnos publicados ni nota: «Nuevo en Oído» y «pago a tiempo», como antes", async ({ page }) => {
  await abrir(page, "/companies/c-1", { rol: "worker", comercio: { ...COMERCIO, rating: 0, events_published: 0, payments_recorded: 4, on_time_payment_rate: 0.75 } });
  await expect(hoja(page)).toContainText("Nuevo en Oído");
  await expect(hoja(page)).toContainText("pago a tiempo 75%");
  await expect(page.locator(".perfil-numero")).toHaveCount(0);
});

test("con nota y sin turnos hechos, la ficha no escribe «0 turnos»", async ({ page }) => {
  await abrir(page, "/workers/wp-1", { trabajador: { ...TRABAJADORA, rating: 4.2, events_completed: 0 } });
  await expect(page.locator(".perfil-numero")).toHaveText(/4,2/);
  await expect(hoja(page)).not.toContainText(/0 turnos/);
  await expect(hoja(page)).not.toContainText(/puntualidad/);
});

// En la compu las fichas públicas van en dos columnas dentro del marco de 1024 px:
// identidad y datos a la izquierda; las reseñas (persona) o el mapa (comercio) a la derecha.
test("en la compu la ficha de una persona lleva las reseñas al lado de los datos, y la del comercio el mapa", async ({ page }) => {
  await abrir(page, "/workers/wp-1", { ancho: 1440, alto: 900 });
  const reputacion = page.locator(".perfil-numero");
  const resenas = page.getByRole("region", { name: "Reseñas" });
  await expect(resenas).toBeVisible();
  const [r, s, h] = await Promise.all([reputacion.boundingBox(), resenas.boundingBox(), hoja(page).boundingBox()]);
  expect(s!.x).toBeGreaterThan(r!.x + 450);
  expect(h!.width).toBeLessThanOrEqual(1024);
  expect(await sinScrollHorizontal(page)).toBe(true);

  await page.goto("/companies/c-1");
  const ubicacion = page.getByRole("region", { name: "Ubicación" });
  await expect(ubicacion).toBeVisible();
  const [r2, u] = await Promise.all([page.locator(".perfil-numero").boundingBox(), ubicacion.boundingBox()]);
  expect(u!.x).toBeGreaterThan(r2!.x + 450);
  expect(await sinScrollHorizontal(page)).toBe(true);
});
