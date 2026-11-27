import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";
import { deContrato } from "./contrato";

/**
 * El título del Inicio de quien trabaja dice la verdad según el estado
 * (lib/inicio-estado.ts): la hora del turno de hoy, cuánto falta, hasta cuándo
 * es, «Hay turno a la vuelta», «Todo tranquilo por ahora» y, mientras no se
 * sabe, dos barras de esqueleto con un `h1` sólo para lectores. El reloj está
 * fijado: hoy es el jueves 19/11/2026 a las 18:00 en Argentina.
 */
const AHORA = new Date("2026-11-19T18:00:00-03:00");
const ar = (dia: string, hora: string) => `${dia}T${hora}:00-03:00`;
const HOY = "2026-11-19";

const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

function turnoDe(inicio: string, fin: string, extra: Record<string, unknown> = {}) {
  return { id: "shift-1", position: "bartender", start_at: inicio, end_at: fin, status: "confirmado", ...extra };
}
const aceptada = (shift: Record<string, unknown> | null) => ({ status: "aceptada", shift_id: "shift-1", shift });

interface Opciones {
  postulaciones?: unknown[];
  feed?: unknown[];
  /** Si se pasa, la respuesta de /applications/mine espera a esta promesa. */
  esperar?: Promise<void>;
  postulacionesFalla?: boolean;
  /** Desde el pedido N (1 = el primero) /applications/mine responde 500. */
  fallaDesde?: number;
  perfil?: Record<string, unknown>;
  tema?: "light" | "dark";
  /** Reloj fijado (por defecto AHORA). */
  ahora?: Date;
}

async function inicio(page: Page, o: Opciones = {}) {
  await page.clock.install({ time: o.ahora ?? AHORA });
  if (o.tema) await setTheme(page, o.tema);
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json(deContrato("auth_me_worker", { full_name: "Sofía Demo" }))));
  await page.route("**/api/v1/shifts/feed**", (r) => r.fulfill(json(o.feed ?? [])));
  let pedidos = 0;
  await page.route("**/api/v1/applications/mine**", async (r) => {
    pedidos += 1;
    if (o.esperar) await o.esperar;
    if (o.postulacionesFalla || (o.fallaDesde !== undefined && pedidos >= o.fallaDesde)) return r.fulfill({ status: 500, contentType: "application/json", body: '{"detail":"x"}' });
    return r.fulfill(json(o.postulaciones ?? []));
  });
  await page.route("**/api/v1/workers/me/profile", (r) =>
    r.fulfill(json(deContrato("perfil_trabajador", { city: "Palermo, CABA", skills: ["mozo"], ...(o.perfil ?? {}) })))
  );
}

const feedUno = () => deContrato("feed", [{ id: "feed-1", start_at: ar("2026-11-21", "20:00"), end_at: ar("2026-11-22", "02:00") }]);
const postulaciones = (turno: Record<string, unknown> | null, extra: Record<string, unknown> = {}) =>
  deContrato("postulaciones_mias", [
    { status: "aceptada", shift_id: "shift-1", ...extra, shift: turno === null ? null : { id: "shift-1", position: "bartender", status: "confirmado", company_name: "Bar Mirasol", address: "Thames 1840", city: "Palermo", ...turno } },
  ]);

const titulo = (page: Page) => page.getByRole("heading", { level: 1 });
/** Lo que se VE del h1: sus textos propios, sin el `span` sólo para lectores. */
const visible = (page: Page) =>
  titulo(page).evaluate((el) =>
    [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("")
  );
const ambares = (page: Page) => page.locator("a.boton-relieve:visible, button.boton-relieve:visible");

test("A1: faltan más de 60 min -> «Hoy trabajás a las 20:00», con el puesto, el lugar y un solo botón ámbar", async ({ page }) => {
  await inicio(page, { postulaciones: postulaciones({ start_at: ar(HOY, "20:00"), end_at: ar("2026-11-20", "02:00") }), feed: feedUno() });
  await page.goto("/feed");
  await expect(titulo(page)).toHaveAccessibleName("Hoy trabajás a las 20:00");
  await expect(titulo(page)).toHaveText("Hoy trabajás a las 20:00");
  // Visible: el saludo con el comienzo de la frase y la hora gigante en el h1.
  await expect(page.getByTestId("inicio-cielo")).toContainText("Hola, Sofía. Hoy trabajás a las");
  expect(await visible(page)).toBe("20:00");
  const m = await titulo(page).evaluate((el) => ({ peso: getComputedStyle(el).fontWeight, tracking: getComputedStyle(el).letterSpacing, nums: getComputedStyle(el).fontVariantNumeric, size: getComputedStyle(el).fontSize }));
  expect(m).toEqual({ peso: "800", tracking: "-3.22px", nums: "tabular-nums", size: "92px" });
  const turno = page.getByTestId("inicio-turno");
  await expect(turno).toContainText("Bartender en Bar Mirasol");
  await expect(turno).toContainText("Thames 1840 · Palermo");
  await expect(page.getByTestId("inicio-cielo")).toHaveAttribute("data-estado", "hoy-mas-tarde");
  await expect(page.getByTestId("inicio-cielo")).not.toHaveClass(/cielo-hondo/);
  const boton = page.getByRole("link", { name: "Ver mi turno" });
  await expect(boton).toHaveAttribute("href", "/my-shifts");
  await expect(ambares(page)).toHaveCount(1);
});

test("A1 sin local: sólo el puesto", async ({ page }) => {
  await inicio(page, { postulaciones: postulaciones({ start_at: ar(HOY, "20:00"), end_at: ar("2026-11-20", "02:00"), company_name: null }) });
  await page.goto("/feed");
  await expect(page.getByTestId("inicio-turno")).toHaveText(/^Bartender\s*Thames 1840 · Palermo$/);
  await expect(page.getByTestId("inicio-turno").locator("p").first()).toHaveText("Bartender");
});

test("A2: faltan 60 min o menos -> cielo hondo y «Empezás en 28 min» que baja con el reloj y pasa a «empezó a las» al empezar", async ({ page }) => {
  await inicio(page, { postulaciones: postulaciones({ start_at: ar(HOY, "18:28"), end_at: ar(HOY, "23:00") }), feed: feedUno() });
  await page.goto("/feed");
  const cielo = page.getByTestId("inicio-cielo");
  await expect(cielo).toHaveClass(/cielo-hondo/);
  await expect(titulo(page)).toHaveAccessibleName("Empezás en 28 min");
  await expect(cielo).toContainText("Bartender en Bar Mirasol. Empezás en");
  expect(await visible(page)).toBe("28 min");
  await expect(ambares(page)).toHaveCount(1);
  await page.clock.pauseAt(new Date(AHORA.getTime() + 5_000));
  await page.clock.runFor("05:00");
  await expect(titulo(page)).toHaveAccessibleName("Empezás en 23 min");
  await page.clock.runFor("22:00");
  await expect(titulo(page)).toHaveAccessibleName("Empezás en 1 min");
  await page.clock.runFor("01:00");
  await expect(titulo(page)).toHaveAccessibleName("Tu turno en Bar Mirasol empezó a las 18:28");
  await expect(cielo).toHaveAttribute("data-estado", "hoy-empezo");
});

test("A3: con la llegada marcada -> «Estás en Bar Mirasol hasta las 23:00», y sin local «Tu turno termina a las 23:00»", async ({ page }) => {
  await inicio(page, { postulaciones: postulaciones({ start_at: ar(HOY, "17:00"), end_at: ar(HOY, "23:00"), status: "check_in" }), feed: feedUno() });
  await page.goto("/feed");
  await expect(page.getByTestId("inicio-cielo")).toHaveClass(/cielo-hondo/);
  await expect(titulo(page)).toHaveAccessibleName("Estás en Bar Mirasol hasta las 23:00");
  expect(await visible(page)).toBe("23:00");
  await expect(page.getByRole("link", { name: "Ver mi turno" })).toHaveAttribute("href", "/my-shifts");
  await expect(ambares(page)).toHaveCount(1);
});

test("A3 sin local", async ({ page }) => {
  await inicio(page, { postulaciones: postulaciones({ start_at: ar("2026-11-18", "22:00"), end_at: ar("2026-11-19", "23:00"), company_name: null, status: "trabajando" }) });
  await page.goto("/feed");
  await expect(titulo(page)).toHaveAccessibleName("Tu turno termina a las 23:00");
});

test("A3 sin llegada marcada: «Tu turno en Bar Mirasol empezó a las 20:00» con la hora de inicio, cielo hondo y «Ver mi turno»", async ({ page }) => {
  await inicio(page, { postulaciones: postulaciones({ start_at: ar(HOY, "17:00"), end_at: ar(HOY, "23:00"), status: "confirmado" }), feed: feedUno() });
  await page.goto("/feed");
  await expect(page.getByTestId("inicio-cielo")).toHaveClass(/cielo-hondo/);
  await expect(page.getByTestId("inicio-cielo")).toHaveAttribute("data-estado", "hoy-empezo");
  await expect(titulo(page)).toHaveAccessibleName("Tu turno en Bar Mirasol empezó a las 17:00");
  await expect(page.getByTestId("inicio-cielo")).toContainText("Tu turno en Bar Mirasol empezó a las");
  expect(await visible(page)).toBe("17:00");
  await expect(page.getByRole("link", { name: "Ver mi turno" })).toHaveAttribute("href", "/my-shifts");
  await expect(ambares(page)).toHaveCount(1);
});

test("A3 sin llegada marcada y sin local: «Tu turno empezó a las 17:00»", async ({ page }) => {
  await inicio(page, { postulaciones: postulaciones({ start_at: ar(HOY, "17:00"), end_at: ar(HOY, "23:00"), status: "asignado", company_name: null }) });
  await page.goto("/feed");
  await expect(titulo(page)).toHaveAccessibleName("Tu turno empezó a las 17:00");
  expect(await visible(page)).toBe("17:00");
});

test("si el refresco de /applications/mine falla, el título sigue en A1 y «Ver mi turno» no se pierde", async ({ page }) => {
  await inicio(page, {
    postulaciones: postulaciones({ start_at: ar(HOY, "20:00"), end_at: ar("2026-11-20", "02:00") }),
    feed: feedUno(),
    fallaDesde: 2,
  });
  await page.goto("/feed");
  await expect(titulo(page)).toHaveAccessibleName("Hoy trabajás a las 20:00");
  const segundo = page.waitForResponse((r) => r.url().includes("/applications/mine") && r.status() === 500);
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.clock.runFor(5000);
  await segundo;
  await expect(titulo(page)).toHaveAccessibleName("Hoy trabajás a las 20:00");
  await expect(page.getByRole("link", { name: "Ver mi turno" })).toBeVisible();
});

test("A2 de medianoche: son las 23:50 y empieza a las 00:20 -> «Empezás en 30 min»", async ({ page }) => {
  await inicio(page, { postulaciones: postulaciones({ start_at: ar("2026-11-20", "00:20"), end_at: ar("2026-11-20", "04:00") }), feed: feedUno(), ahora: new Date("2026-11-19T23:50:00-03:00") });
  await page.goto("/feed");
  await expect(titulo(page)).toHaveAccessibleName("Empezás en 30 min");
  await expect(page.getByTestId("inicio-cielo")).toHaveClass(/cielo-hondo/);
});

test("con el turno de hoy a la vista, «Completar mi perfil» deja de ser ámbar y el vacío tampoco suma otro", async ({ page }) => {
  await inicio(page, {
    postulaciones: postulaciones({ start_at: ar(HOY, "20:00"), end_at: ar("2026-11-20", "02:00") }),
    feed: [],
    perfil: { latitude: null, longitude: null, skills: [] },
  });
  await page.goto("/feed");
  await expect(page.getByTestId("perfil-faltante")).toBeVisible();
  await expect(page.getByTestId("perfil-faltante").getByRole("link", { name: "Completar mi perfil" })).not.toHaveClass(/boton-relieve/);
  await expect(ambares(page)).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Ver mi turno" })).toBeVisible();
});

test("sin turno de hoy, «Completar mi perfil» sigue siendo el ámbar", async ({ page }) => {
  await inicio(page, { feed: feedUno(), perfil: { latitude: null, longitude: null, skills: [] } });
  await page.goto("/feed");
  await expect(page.getByTestId("perfil-faltante").getByRole("link", { name: "Completar mi perfil" })).toHaveClass(/boton-relieve/);
  await expect(ambares(page)).toHaveCount(1);
});

test("B: sin turno hoy y con turnos -> «Hay turno a la vuelta» (el turno de mañana no cuenta)", async ({ page }) => {
  await inicio(page, { postulaciones: postulaciones({ start_at: ar("2026-11-20", "09:00"), end_at: ar("2026-11-20", "15:00") }), feed: feedUno() });
  await page.goto("/feed");
  await expect(titulo(page)).toHaveAccessibleName("Hay turno a la vuelta");
  await expect(page.getByTestId("inicio-cielo")).toHaveAttribute("data-estado", "con-turnos");
  await expect(page.getByRole("link", { name: "Ver mi turno" })).toHaveCount(0);
});

test("C: sin turno hoy y sin turnos -> «Todo tranquilo por ahora» en dos renglones, con su vacío abajo", async ({ page }) => {
  await inicio(page, { feed: [] });
  await page.goto("/feed");
  await expect(titulo(page)).toHaveAccessibleName("Todo tranquilo por ahora");
  expect(await titulo(page).evaluate((el) => (el as HTMLElement).innerText)).toBe("Todo tranquilo\npor ahora");
  await expect(page.getByRole("heading", { level: 2, name: /Todavía no hay turnos cerca de tu zona|No hay más turnos cerca/ })).toBeVisible();
  // Tiene el alto de dos renglones del título de B.
  const alto = await titulo(page).evaluate((el) => el.getBoundingClientRect().height);
  expect(alto).toBeGreaterThanOrEqual(92);
});

test("D: cargando -> dos barras de esqueleto y un h1 «Inicio» sólo para lectores; al resolverse el cielo no cambia de alto", async ({ page }) => {
  let soltar!: () => void;
  const esperar = new Promise<void>((ok) => (soltar = ok));
  await inicio(page, { esperar, feed: feedUno() });
  await page.goto("/feed");
  const cielo = page.getByTestId("inicio-cielo");
  await expect(cielo).toHaveAttribute("data-estado", "cargando");
  await expect(page.getByText("Hola, Sofía.", { exact: true })).toBeVisible();
  await expect(titulo(page)).toHaveAccessibleName("Inicio");
  await expect(titulo(page)).toHaveCSS("position", "absolute"); // sr-only
  await expect(page.getByTestId("inicio-titulo-esqueleto")).toBeVisible();
  const barra = page.getByTestId("inicio-titulo-esqueleto").locator("div").first();
  expect(await barra.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgba(255, 255, 255, 0.35)");
  const altoCargando = (await cielo.boundingBox())!.height;
  soltar();
  await expect(cielo).toHaveAttribute("data-estado", "con-turnos");
  await expect(titulo(page)).toHaveAccessibleName("Hay turno a la vuelta");
  expect((await cielo.boundingBox())!.height).toBeCloseTo(altoCargando, 0);
});

test("D sin animación si la persona pidió menos movimiento", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const esperar = new Promise<void>(() => {});
  await inicio(page, { esperar });
  await page.goto("/feed");
  const barra = page.getByTestId("inicio-titulo-esqueleto").locator("div").first();
  await expect(barra).toBeVisible();
  expect(await barra.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
});

test("E: si /applications/mine falla, el Inicio sigue (B o C)", async ({ page }) => {
  await inicio(page, { postulacionesFalla: true, feed: feedUno() });
  await page.goto("/feed");
  await expect(titulo(page)).toHaveAccessibleName("Hay turno a la vuelta");
});

test("si el feed falla, el título no queda en el esqueleto: dice «Inicio» y abajo está el error", async ({ page }) => {
  await inicio(page, { feed: [] });
  await page.route("**/api/v1/shifts/feed**", (r) => r.fulfill({ status: 500, contentType: "application/json", body: '{"detail":"x"}' }));
  await page.goto("/feed");
  await expect(page.getByRole("heading", { level: 2, name: "No pudimos cargar" })).toBeVisible();
  await expect(titulo(page)).toHaveAccessibleName("Inicio");
  await expect(page.getByTestId("inicio-cielo")).toHaveAttribute("data-estado", "con-error");
});

test("E: una postulación aceptada sin shift se ignora", async ({ page }) => {
  await inicio(page, { postulaciones: postulaciones(null), feed: [] });
  await page.goto("/feed");
  await expect(titulo(page)).toHaveAccessibleName("Todo tranquilo por ahora");
});

test("E: un turno cancelado o terminado no se anuncia", async ({ page }) => {
  await inicio(page, { postulaciones: postulaciones({ start_at: ar(HOY, "20:00"), end_at: ar("2026-11-20", "02:00"), status: "cancelado" }), feed: feedUno() });
  await page.goto("/feed");
  await expect(titulo(page)).toHaveAccessibleName("Hay turno a la vuelta");
});

for (const estado of ["a1", "a2", "a3", "b", "c"] as const) {
  test(`a 320 px con el texto al 200 % no hay desborde horizontal (${estado})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    const turno =
      estado === "a1" ? { start_at: ar(HOY, "20:00"), end_at: ar("2026-11-20", "02:00") }
      : estado === "a2" ? { start_at: ar(HOY, "18:28"), end_at: ar(HOY, "23:00") }
      : estado === "a3" ? { start_at: ar(HOY, "17:00"), end_at: ar(HOY, "23:00"), status: "check_in" }
      : null;
    await inicio(page, { postulaciones: turno ? postulaciones({ ...turno, company_name: "Restaurante Los Tres Hermanos del Sur" }) : [], feed: estado === "c" ? [] : feedUno() });
    await page.goto("/feed");
    // Se mide recién con el estado final: mientras carga hay otro `h1` («Inicio»,
    // sólo para lectores) que se reemplaza, y medirlo a destiempo daba null.
    const final = { a1: "hoy-mas-tarde", a2: "hoy-por-empezar", a3: "hoy-en-curso", b: "con-turnos", c: "tranquilo" }[estado];
    await expect(page.getByTestId("inicio-cielo")).toHaveAttribute("data-estado", final);
    await expect(titulo(page)).toBeVisible();
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe("32px");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    // El título tampoco se sale de su cielo.
    const sale = await titulo(page).evaluate((el) => {
      const cielo = el.closest("[data-testid=inicio-cielo]")!.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      return r.right > cielo.right + 0.5 || r.left < cielo.left - 0.5;
    });
    expect(sale).toBe(false);
  });
}

test("el ícono del vacío va en el azul de los links y no en el ámbar", async ({ page }) => {
  await inicio(page, { feed: [] });
  await page.goto("/feed");
  const trazo = page.locator(".empty-state-icono svg [stroke]").first();
  await expect(trazo).toBeAttached();
  const colores = await page.evaluate(() => ({
    trazo: getComputedStyle(document.querySelector(".empty-state-icono svg [stroke]")!).stroke,
    link: getComputedStyle(document.documentElement).getPropertyValue("--color-primary-text").trim(),
  }));
  expect(colores.link).toBe("#1c5478");
  expect(colores.trazo).toBe("rgb(28, 84, 120)");
});
