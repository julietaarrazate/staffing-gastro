import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

/**
 * El Perfil de quien trabaja con la dirección suave (2026-11-20, ADR-0028,
 * docs/historial/2026-11-20-perfil-trabajador-direccion-suave.md): el cielo
 * medio con el nombre, la foto a caballo de la hoja, la reputación como número
 * grande, una reseña a la vista y el resto como filas suaves. Los datos y las
 * acciones son los de antes, y hay un solo ámbar. El perfil del comercio no
 * cambia.
 */
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const AMBAR = /rgb\(246, 169, 42\)|rgb\(229, 142, 15\)|rgb\(245, 158, 11\)|rgb\(217, 119, 6\)|rgb\(255, 171, 37\)|rgb\(251, 191, 36\)/;
const claim = (status: string) => ({
  claim_type: "documento_verificado",
  status,
  confidence: null,
  decided_at: null,
  rejection_reason: null,
});
const PERFIL = {
  id: "profile-1",
  user_id: "user-1",
  full_name: "Camila Rojas",
  photo_url: null,
  birth_date: null,
  age: null,
  city: "Palermo, CABA",
  bio: null,
  latitude: -34.58,
  longitude: -58.42,
  skills: ["bartender", "mozo"],
  years_experience: 4,
  languages: [],
  certifications: [],
  cv_url: null,
  cv_filename: null,
  is_available: true,
  rating: 4.86,
  events_completed: 32,
  punctuality_rate: 0.97,
  cancellations: 0,
  no_shows: 0,
  badges: ["nunca_falto"],
  level: "oro",
  identidad_verificada: true,
};
const resena = (id: string, rating: number, comment: string | null, created_at: string) => ({
  id,
  shift_id: `s-${id}`,
  reviewer_user_id: "c1",
  reviewee_user_id: "user-1",
  rating,
  comment,
  created_at,
});
const RESENAS = [
  resena("r1", 4, null, "2026-11-16T23:00:00Z"),
  resena("r2", 5, "Llegó antes de hora y resolvió la barra sola.", "2026-11-14T23:00:00Z"),
  resena("r3", 5, "Muy buena onda con los clientes.", "2026-11-02T23:00:00Z"),
];

async function perfil(
  page: Page,
  {
    datos = PERFIL,
    claims = [claim("verificada")],
    resenas = RESENAS,
    rol = "worker",
  }: { datos?: object; claims?: object[]; resenas?: object[]; rol?: string } = {}
) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) =>
    r.fulfill(json({ id: "user-1", email: "camila@oido.test", full_name: "Camila Rojas", role: rol, status: "activo", is_active: true, is_verified: true }))
  );
  await page.route("**/api/v1/workers/me/profile", (r) => r.fulfill(json(datos)));
  await page.route("**/api/v1/workers/me/earnings", (r) =>
    r.fulfill(json({ total_earned: "480000", this_month_earned: "120000", shifts_completed: 32 }))
  );
  await page.route("**/api/v1/reviews/received", (r) => r.fulfill(json(resenas)));
  await page.route("**/api/v1/identity/me", (r) =>
    r.fulfill(json({ user_id: "user-1", assurance_level: "basico", claims }))
  );
  await page.route("**/api/v1/workers/me/available-now", (r) => r.fulfill(json({ active: false, until: null })));
}

/** Cuántos elementos a la vista están pintados de ámbar (fondo o degradé). */
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

test("el cielo con el nombre, la foto a caballo de la hoja y la reputación en grande", async ({ page }) => {
  await perfil(page);
  await page.goto("/profile");

  // El encabezado se llama como la persona (no «Editar nombre», que es el
  // botón), y el nombre a la vista va en la letra de título de pantalla.
  await expect(page.getByRole("heading", { level: 1, name: "Camila Rojas" })).toHaveCount(1);
  await expect(page.locator(".app-cielo .titulo-pantalla")).toHaveText("Camila Rojas");
  await expect(page.getByText("Bartender y Mozo/a · Palermo, CABA")).toBeVisible();
  await expect(page.locator(".app-cielo .chip-vidrio")).toHaveText("Nivel Oro");

  // La foto monta sobre el borde entre el cielo y la hoja.
  const foto = await page.getByRole("button", { name: "Subir foto de perfil" }).boundingBox();
  const hoja = await page.locator(".hoja").boundingBox();
  expect(foto!.y).toBeLessThan(hoja!.y);
  expect(foto!.y + foto!.height).toBeGreaterThan(hoja!.y);

  // La reputación: el número más grande de la hoja, con las estrellas en azul.
  const numero = page.locator(".perfil-numero");
  await expect(numero).toContainText("4,9");
  expect(await numero.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(56);
  await expect(page.getByText("32 turnos hechos · puntualidad 97%")).toBeVisible();
  await expect(page.locator(".hoja .chip-suave", { hasText: "Identidad verificada" })).toBeVisible();
  // Verificada: queda la nota, sin repetir el sello ni el formulario.
  await expect(page.getByText(/No guardamos tu DNI/)).toBeVisible();
  await expect(page.getByText("Verificación de identidad")).toHaveCount(0);

  // Los mismos datos de antes, como filas.
  const datos = page.locator("dl.perfil-filas");
  await expect(datos).toContainText("Ganado este mes");
  await expect(datos).toContainText("$120.000");
  await expect(datos).toContainText("$480.000 en total");
  await expect(datos).toContainText("Cancelaciones");
  await expect(datos).toContainText("Años de experiencia");
  await expect(page.getByText("Nunca faltó")).toBeVisible();

  // Las mismas salidas.
  await expect(page.getByRole("link", { name: "Editar perfil" })).toHaveAttribute("href", "/profile/edit");
  await expect(page.getByRole("link", { name: "Ajustes" })).toHaveAttribute("href", "/profile/settings");
  await expect(page.getByRole("button", { name: "Invitá a tu comercio" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Editar nombre" })).toBeVisible();

  // Un solo ámbar: «Estoy disponible ahora».
  await expect(page.getByRole("button", { name: "Estoy disponible ahora" })).toBeVisible();
  expect(await ambares(page)).toBe(1);

  const ancho = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(ancho).toBeLessThanOrEqual(0);
});

test("una reseña a la vista (la más nueva que dice algo) y las demás detrás de «Ver las N reseñas»", async ({ page }) => {
  await perfil(page);
  await page.goto("/profile");

  const resenas = page.getByRole("region", { name: "Reseñas recibidas" });
  await expect(resenas.getByText("«Llegó antes de hora y resolvió la barra sola.»")).toBeVisible();
  await expect(resenas.getByText("14 de noviembre")).toBeVisible();
  await expect(resenas.getByText("«Muy buena onda con los clientes.»")).toBeHidden();

  const ver = resenas.getByRole("button", { name: "Ver las 3 reseñas" });
  await expect(ver).toHaveAttribute("aria-expanded", "false");
  await ver.click();
  await expect(resenas.getByText("«Muy buena onda con los clientes.»")).toBeVisible();
  await expect(resenas.getByText("16 de noviembre")).toBeVisible();
  await expect(resenas.getByRole("img", { name: "4 de 5 estrellas" })).toBeVisible();
  await resenas.getByRole("button", { name: "Ver menos reseñas" }).click();
  await expect(resenas.getByText("«Muy buena onda con los clientes.»")).toBeHidden();
});

test("con una sola reseña no hay «Ver las reseñas»", async ({ page }) => {
  await perfil(page, { resenas: [RESENAS[1]] });
  await page.goto("/profile");
  await expect(page.getByText("«Llegó antes de hora y resolvió la barra sola.»")).toBeVisible();
  await expect(page.getByRole("button", { name: /Ver las/ })).toHaveCount(0);
});

test("sin verificar: el formulario va arriba, sin chip, y «Disponible ahora» queda quieta (un solo ámbar)", async ({ page }) => {
  await perfil(page, { datos: { ...PERFIL, identidad_verificada: false }, claims: [] });
  await page.goto("/profile");

  await expect(page.getByText("Verificación de identidad")).toBeVisible();
  await expect(page.getByRole("button", { name: "Subir DNI (frente)" })).toBeVisible();
  await expect(page.locator(".chip-suave", { hasText: "Identidad verificada" })).toHaveCount(0);
  // La acción de la pantalla es «Enviar a revisión» (apagada hasta subir las
  // dos fotos); «Estoy disponible ahora» no compite con ella.
  await expect(page.getByRole("button", { name: "Enviar a revisión" })).toBeDisabled();
  const disponible = page.getByRole("button", { name: "Estoy disponible ahora" });
  await expect(disponible).toBeVisible();
  expect(await disponible.evaluate((el) => getComputedStyle(el).backgroundImage)).toBe("none");
  expect(await ambares(page)).toBe(0);
});

test("en revisión: se dice, y «Disponible ahora» vuelve a ser la acción", async ({ page }) => {
  await perfil(page, { datos: { ...PERFIL, identidad_verificada: false }, claims: [claim("pendiente")] });
  await page.goto("/profile");
  await expect(page.getByText("Estamos revisando tu documento.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar a revisión" })).toHaveCount(0);
  await expect
    .poll(() => page.getByRole("button", { name: "Estoy disponible ahora" }).evaluate((el) => getComputedStyle(el).backgroundImage))
    .toMatch(AMBAR);
  expect(await ambares(page)).toBe(1);
});

test("con turnos pero sin nota: el número grande son los turnos, sin estrellas vacías", async ({ page }) => {
  await perfil(page, { datos: { ...PERFIL, rating: 0, events_completed: 3, no_shows: 1 }, resenas: [] });
  await page.goto("/profile");
  await expect(page.locator(".perfil-numero")).toHaveText("3");
  await expect(page.getByText("turnos hechos", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: /estrellas/ })).toHaveCount(0);
  await expect(page.locator("dl.perfil-filas")).toContainText("Ausencias");
  await expect(page.getByRole("link", { name: "Soporte" })).toHaveAttribute("href", "/support");
});

test("un nombre larguísimo no ensancha la pantalla a 320 px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await perfil(page);
  await page.route("**/api/v1/auth/me", (r) =>
    r.fulfill(json({ id: "user-1", email: "m@oido.test", full_name: "Maximiliano Fernández Etchegaray del Valle Inclán", role: "worker", status: "activo", is_active: true, is_verified: true }))
  );
  await page.goto("/profile");
  await expect(page.locator(".titulo-pantalla")).toContainText("Maximiliano");
  await expect(page.locator(".perfil-numero")).toBeVisible();
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(ancho).toBeLessThanOrEqual(0);
  // El lápiz de vidrio no queda tapado por el nombre.
  const editar = await page.getByRole("link", { name: "Editar perfil" }).boundingBox();
  expect(editar!.x + editar!.width).toBeLessThanOrEqual(320);
});

for (const theme of ["light", "dark"] as const) {
  test(`contraste de lo que se lee sobre el relleno del campo (${theme})`, async ({ page }) => {
    await setTheme(page, theme);
    await perfil(page, { datos: { ...PERFIL, identidad_verificada: false }, claims: [] });
    await page.goto("/profile");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.getByText("Verificación de identidad")).toBeVisible();
    const razon = (texto: string | RegExp) =>
      page
        .getByText(texto)
        .first()
        .evaluate((el) => {
          const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
          const lum = ([r, g, b]: number[]) => {
            const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
            return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
          };
          let fondo: number[] = [];
          for (let n: Element | null = el; n; n = n.parentElement) {
            const c = rgb(getComputedStyle(n).backgroundColor);
            if (c.length === 3 || c[3] === 1) {
              fondo = c;
              break;
            }
          }
          const a = lum(rgb(getComputedStyle(el).color));
          const b = lum(fondo);
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        });
    expect(await razon(/Usamos estas imágenes/)).toBeGreaterThanOrEqual(4.5);
    expect(await razon(/Compartís tu posición UNA vez/)).toBeGreaterThanOrEqual(4.5);
    expect(await razon("14 de noviembre")).toBeGreaterThanOrEqual(4.5);
    expect(await razon("Estoy disponible ahora")).toBeGreaterThanOrEqual(4.5);
  });
}

// El perfil del comercio también pasó a la dirección suave (2026-11-21): lo
// prueba `perfil-comercio-suave.spec.ts`.
