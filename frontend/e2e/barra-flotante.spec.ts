import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, injectSession, setTheme, skipSplash } from "./mocks";
import { deContrato } from "./contrato";

/**
 * La barra flotante, el encabezado y el «+» de «Publicar turno» (Julieta,
 * 2026-11-20; docs/historial/2026-11-20-barra-flotante-y-encabezado.md):
 *
 * - en el celular, quien trabaja y el comercio no tienen encabezado: «oído» y
 *   la campanita van sobre el cielo del Inicio y del Panel, y en las demás
 *   pantallas la cuenta de avisos sin leer va sobre esa pestaña de la barra;
 * - la barra de abajo es una píldora separada de los bordes, y el comercio
 *   tiene al lado el «+» de «Publicar turno»;
 * - en la compu la barra es la de arriba, con la campanita en todas las
 *   pantallas y «Publicar turno» al lado para el comercio.
 *
 * Se mide con la pantalla renderizada, en claro y de noche.
 */
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const WORKER = { id: "u", email: "w@oido.test", full_name: "Sofía Demo", role: "worker", status: "activo", is_active: true, is_verified: true };
const EMPLOYER = { ...WORKER, id: "u-e", email: "e@oido.test", full_name: "Julieta Demo", role: "employer" };

async function abrir(page: Page, quien: "worker" | "employer", ruta: string, tema: "light" | "dark" = "light") {
  await setTheme(page, tema);
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  // Catch-all primero: Playwright resuelve la última ruta registrada.
  await page.route("**/api/v1/**", (r) => (r.request().method() === "GET" ? r.fulfill(json([])) : r.continue()));
  await page.route("**/api/v1/notifications", (r) =>
    r.fulfill(json(deContrato("avisos_trabajador", [{ id: "notification-3" }, { id: "notification-4" }])))
  );
  await page.route("**/api/v1/notifications/*/read", (r) => r.fulfill(json({})));
  await page.route("**/api/v1/auth/me", (r) => r.fulfill(json(quien === "worker" ? WORKER : EMPLOYER)));
  await page.route("**/api/v1/workers/me/profile", (r) =>
    r.fulfill(json(deContrato("perfil_trabajador", { city: "Palermo, CABA", skills: ["mozo"] })))
  );
  await page.goto(ruta);
  await expect(page.locator("html")).toHaveAttribute("data-theme", tema);
}

const barra = (page: Page) => page.getByRole("navigation", { name: "Secciones" });

for (const tema of ["light", "dark"] as const) {
  test(`celular (${tema}): la barra flota, separada de los bordes, y la activa lleva su óvalo`, async ({ page }) => {
    await abrir(page, "worker", "/buscar", tema);
    const caja = await barra(page).boundingBox();
    expect(caja).not.toBeNull();
    expect(caja!.x).toBeGreaterThanOrEqual(12);
    expect(390 - (caja!.x + caja!.width)).toBeGreaterThanOrEqual(12);
    expect(844 - (caja!.y + caja!.height)).toBeGreaterThanOrEqual(12);

    const activa = barra(page).getByRole("link", { name: "Buscar" });
    await expect(activa).toHaveAttribute("aria-current", "page");
    const [ovalo, otra] = await Promise.all(
      ["Buscar", "Turnos"].map((nombre) =>
        barra(page)
          .getByRole("link", { name: nombre })
          .locator(".barra-app-icono")
          .evaluate((el) => getComputedStyle(el).backgroundColor)
      )
    );
    expect(ovalo).not.toBe(otra);
  });
}

test("celular: sin encabezado; fuera del Inicio la cuenta de avisos va en su pestaña y la campanita está en el cielo del Inicio", async ({
  page,
}) => {
  await abrir(page, "worker", "/buscar");
  await expect(page.getByRole("banner")).toBeHidden();
  await expect(page.getByRole("button", { name: "Notificaciones" })).toBeHidden();
  const inicio = barra(page).getByRole("link", { name: "Inicio, 2 avisos sin leer" });
  await expect(inicio).toBeVisible();

  await inicio.click();
  await expect(page).toHaveURL(/\/feed$/);
  // En el Inicio la cuenta está en la campanita, no repetida en la pestaña.
  await expect(barra(page).getByRole("link", { name: "Inicio", exact: true })).toBeVisible();
  const campanita = page.getByTestId("inicio-cielo").getByRole("button", { name: "Notificaciones" });
  await expect(campanita).toContainText("2");

  await campanita.click();
  const hoja = page.getByRole("dialog", { name: "Notificaciones" });
  await expect(hoja.getByRole("button", { name: "Marcar todas como leídas" })).toBeVisible();
  // La hoja entra en la pantalla: no se sale por los costados.
  const caja = await hoja.boundingBox();
  expect(caja!.x).toBeGreaterThanOrEqual(0);
  expect(caja!.x + caja!.width).toBeLessThanOrEqual(390);
  await page.keyboard.press("Escape");
  await expect(hoja).toBeHidden();
});

test("celular, comercio: «oído» y la campanita sobre el cielo del Panel, y el «+» de «Publicar turno» en el centro de la barra", async ({
  page,
}) => {
  await abrir(page, "employer", "/shifts");
  await expect(page.getByRole("banner")).toBeHidden();
  const cielo = page.getByTestId("panel-cielo");
  await expect(cielo.getByRole("img", { name: "Oído" })).toBeVisible();
  await expect(cielo.getByRole("button", { name: "Notificaciones" })).toBeVisible();

  const mas = page.locator(".barra-app").getByRole("link", { name: "Publicar turno" });
  const [cajaBarra, cajaMas] = await Promise.all([barra(page).boundingBox(), mas.boundingBox()]);
  // En el centro de la píldora (2026-11-21, reemplaza al «+» al costado de #712).
  expect(Math.abs(cajaMas!.x + cajaMas!.width / 2 - (cajaBarra!.x + cajaBarra!.width / 2))).toBeLessThanOrEqual(1);
  expect(cajaMas!.width).toBeGreaterThanOrEqual(48);

  await mas.click();
  await expect(page).toHaveURL(/\/shifts\/new$/);
  // Publicando, el «+» no va: ya se está en eso.
  await expect(page.locator(".barra-app").getByRole("link", { name: "Publicar turno" })).toHaveCount(0);
});

for (const tema of ["light", "dark"] as const) {
  test(`compu (${tema}): la barra es la de arriba, con la campanita en toda pantalla y «Publicar turno» para el comercio`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await abrir(page, "employer", "/search", tema);
    await expect(barra(page)).toBeHidden();
    const arriba = page.getByRole("banner");
    await expect(arriba.getByRole("link", { name: "Buscar" })).toHaveAttribute("aria-current", "page");
    await expect(arriba.getByRole("button", { name: "Notificaciones" })).toContainText("2");
    await arriba.getByRole("link", { name: "Publicar turno" }).click();
    await expect(page).toHaveURL(/\/shifts\/new$/);
  });
}

test("tablet (768 px): la barra de arriba del comercio entra entera", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await abrir(page, "employer", "/shifts");
  const arriba = page.getByRole("banner");
  for (const nombre of ["Panel", "Buscar", "Favoritos", "Mensajes", "Mi plan", "Mi comercio", "Publicar turno"]) {
    const caja = await arriba.getByRole("link", { name: nombre, exact: true }).boundingBox();
    expect(caja, nombre).not.toBeNull();
    expect(caja!.x, nombre).toBeGreaterThanOrEqual(0);
    expect(caja!.x + caja!.width, nombre).toBeLessThanOrEqual(768);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(768);
});

/**
 * El velo de la barra flotante (Julieta, 2026-11-21;
 * docs/historial/2026-11-21-barra-velo-y-mas-al-centro.md): `.barra-app::before`
 * esfuma en el color del fondo lo que pasaría por detrás de la barra. Vive sólo
 * en el hueco que la pantalla deja libre para la barra, no recibe toques y su
 * color es el del fondo de cada pantalla (la hoja en las suaves, el lienzo en las demás).
 */
const velo = async (page: Page) => {
  await page.locator(".barra-app").waitFor();
  return page.evaluate(() => {
    const barra = document.querySelector(".barra-app") as HTMLElement;
    const cs = getComputedStyle(barra, "::before");
    const medir = (css: string) => {
      const el = document.createElement("i");
      el.style.cssText = `position:absolute;visibility:hidden;${css}`;
      document.body.appendChild(el);
      const r = el.getBoundingClientRect();
      const color = getComputedStyle(el).color;
      el.remove();
      return { alto: r.height, color };
    };
    const { alto: reservado } = medir("height:var(--chrome-bottom)");
    const { color } = medir("color:var(--barra-velo)");
    const main = (document.querySelector("main") ?? document.body) as HTMLElement;
    const fondo = getComputedStyle(main).backgroundColor;
    const bg = cs.backgroundImage;
    const stop = Number(/rgb[a]?\([^)]*\)\s+([\d.]+)px/.exec(bg.replace(/rgba\(0, 0, 0, 0\)/, ""))?.[1] ?? NaN);
    return {
      content: cs.content,
      position: cs.position,
      eventos: cs.pointerEvents,
      altoVelo: parseFloat(cs.height),
      reservado,
      color,
      fondo: fondo === "rgba(0, 0, 0, 0)" ? getComputedStyle(document.body).backgroundColor : fondo,
      gradiente: bg.startsWith("linear-gradient"),
      stop,
      transicion: cs.transitionDuration,
      animacion: cs.animationName,
      barraEventos: getComputedStyle(barra).pointerEvents,
    };
  });
};

// Un «contenido» que pasa por detrás de la barra (debajo de ella en el apilado)
// y los píxeles reales de la captura, leídos desde otra página.
async function pixeles(page: Page, puntos: [number, number][]) {
  await page.waitForTimeout(400);
  const png = (await page.screenshot({ animations: "disabled" })).toString("base64");
  const otra = await page.context().newPage();
  try {
    return await otra.evaluate(
      async ({ png, puntos }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${png}`;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const g = c.getContext("2d")!;
        g.drawImage(img, 0, 0);
        return puntos.map(([x, y]) => Array.from(g.getImageData(x, y, 1, 1).data).slice(0, 3));
      },
      { png, puntos }
    );
  } finally {
    await otra.close();
  }
}

const RUTAS_VELO = [
  { quien: "worker", ruta: "/feed", nombre: "Inicio de quien trabaja (pantalla suave)" },
  { quien: "employer", ruta: "/shifts", nombre: "Panel del comercio (pantalla suave)" },
] as const;

for (const tema of ["light", "dark"] as const) {
  for (const { quien, ruta, nombre } of RUTAS_VELO) {
    test(`velo (${tema}): ${nombre}: existe, no recibe toques y es del color del fondo`, async ({ page }) => {
      await abrir(page, quien, ruta, tema);
      const v = await velo(page);
      expect(v.content).toBe('""');
      expect(v.position).toBe("absolute");
      expect(v.eventos).toBe("none");
      expect(v.barraEventos).toBe("none");
      expect(v.gradiente).toBe(true);
      // El mismo color que el fondo de la pantalla: sin franja ni escalón.
      expect(v.color).toBe(v.fondo);
      // Ocupa sólo el hueco reservado para la barra: lo que descansa al final
      // de la pantalla (el último turno, el campo del chat) queda por encima.
      expect(Math.abs(v.altoVelo - v.reservado)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(v.stop + 82 - v.reservado)).toBeLessThanOrEqual(0.5);
    });
  }

  test(`velo (${tema}): un contenido que pasa por detrás de la barra se esfuma y no se ve por debajo de la píldora`, async ({
    page,
  }) => {
    await abrir(page, "worker", "/buscar", tema);
    const fondo = (await velo(page)).fondo;
    // Un bloque negro a todo el ancho, detrás de la barra (z-index 30 < 40),
    // desde bien arriba hasta el borde de abajo de la pantalla.
    await page.evaluate(() => {
      const d = document.createElement("div");
      d.id = "detras";
      d.textContent = "DETRÁS DE LA BARRA";
      d.style.cssText = "position:fixed;left:0;right:0;top:500px;bottom:0;z-index:30;background:#000;color:#fff;font:700 40px sans-serif";
      document.body.appendChild(d);
    });
    const [lejos, alAire, abajo, pie, costado] = await pixeles(page, [
      [4, 844 - 100], // apenas arriba del hueco de la barra: se ve el bloque entero, sin velo
      [4, 844 - 87], // en medio del degradé (entre 82 y 92 px del borde): ya no es negro puro
      [4, 844 - 60], // al costado de la píldora: sólo el fondo
      [195, 844 - 4], // por debajo de la píldora: sólo el fondo
      [386, 844 - 30], // al otro costado
    ]);
    expect(lejos).toEqual([0, 0, 0]);
    expect(alAire[0]).toBeGreaterThan(0);
    const [r, g, b] = fondo.match(/\d+/g)!.map(Number);
    for (const px of [abajo, pie, costado]) {
      // Tolerancia 25: la sombra difusa de la píldora oscurece un poco (el negro difiere en ~250).
      expect(Math.abs(px[0] - r)).toBeLessThanOrEqual(25);
      expect(Math.abs(px[1] - g)).toBeLessThanOrEqual(25);
      expect(Math.abs(px[2] - b)).toBeLessThanOrEqual(25);
    }
  });
}

test("velo: los toques pasan por el velo y por los costados de la píldora; la píldora sigue tocándose", async ({ page }) => {
  await abrir(page, "worker", "/buscar");
  await page.evaluate(() => {
    (window as unknown as { toques: string[] }).toques = [];
    const crear = (id: string, css: string) => {
      const b = document.createElement("button");
      b.id = id;
      b.style.cssText = `position:fixed;z-index:30;width:12px;height:12px;${css}`;
      b.addEventListener("click", () => (window as unknown as { toques: string[] }).toques.push(id));
      document.body.appendChild(b);
    };
    crear("degrade", "left:2px;bottom:90px"); // en el degradé
    crear("costado", "left:2px;bottom:40px"); // al costado de la píldora
    crear("debajo", "left:190px;bottom:2px"); // por debajo de la píldora
  });
  await page.mouse.click(8, 844 - 96);
  await page.mouse.click(8, 844 - 46);
  await page.mouse.click(196, 844 - 8);
  await barra(page).getByRole("link", { name: "Turnos" }).click();
  await expect(page).toHaveURL(/\/my-shifts$/);
  expect(await page.evaluate(() => (window as unknown as { toques: string[] }).toques)).toEqual(["degrade", "costado", "debajo"]);
});

test("velo: el comercio y el admin (sin hoja) usan el color del lienzo; el admin no es una pantalla suave", async ({ page }) => {
  await abrir(page, "employer", "/shifts");
  expect((await velo(page)).color).toBe("rgb(255, 255, 255)");
  const lienzo = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--background").trim());
  // Una pantalla sin `.estilo-suave` ni `.bajo-barra-hoja` toma `--background`.
  await page.evaluate(() => document.querySelectorAll(".estilo-suave,.bajo-barra-hoja").forEach((e) => e.classList.remove("estilo-suave", "bajo-barra-hoja")));
  const sin = await velo(page);
  const esperado = await page.evaluate((l) => {
    const el = document.createElement("i");
    el.style.color = l;
    document.body.appendChild(el);
    const c = getComputedStyle(el).color;
    el.remove();
    return c;
  }, lienzo);
  expect(sin.color).toBe(esperado);
});

test("velo: letra al 200 % y reducir movimiento: sigue ocupando sólo el hueco y no se anima", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await abrir(page, "worker", "/buscar");
  await page.addStyleTag({ content: "html{font-size:200% !important}" });
  await page.waitForTimeout(300);
  const v = await velo(page);
  expect(v.reservado).toBeGreaterThan(160); // 5,75 rem a 32 px
  expect(Math.abs(v.altoVelo - v.reservado)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(v.stop + 82 - v.reservado)).toBeLessThanOrEqual(0.5);
  expect(v.animacion).toBe("none");
  expect(parseFloat(v.transicion)).toBeLessThan(0.001);
});

test("velo: en la compu la barra no existe y no queda ningún velo", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await abrir(page, "worker", "/feed");
  await expect(page.locator(".barra-app")).toHaveCSS("display", "none");
});

/**
 * El «+» de «Publicar turno» en el centro de la píldora del comercio (Julieta,
 * 2026-11-21): dos pestañas de cada lado, sobresale unos 10 px por arriba con
 * un aro del color de la píldora, sin ámbar, con foco visible y el orden de
 * teclado Panel, Buscar, +, Chats, Perfil. Se mide con la pantalla renderizada.
 */
for (const ancho of [390, 320]) {
  for (const tema of ["light", "dark"] as const) {
    test(`«+» al centro (${ancho} px, ${tema}): centrado ±1 px, dos pestañas a cada lado, nada se pisa`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: ancho === 320 ? 568 : 844 });
      await abrir(page, "employer", "/shifts", tema);
      const mas = barra(page).getByRole("link", { name: "Publicar turno" });
      await expect(mas).toBeVisible();
      const pildora = (await barra(page).boundingBox())!;
      const cm = (await mas.boundingBox())!;
      expect(Math.abs(cm.x + cm.width / 2 - (pildora.x + pildora.width / 2))).toBeLessThanOrEqual(1);
      expect(cm.width).toBeGreaterThanOrEqual(56 - 0.5);
      expect(cm.width).toBeLessThanOrEqual(60);
      // Sobresale 10–12 px por arriba de la píldora y queda dentro de la pantalla.
      const sobresale = pildora.y - cm.y;
      expect(sobresale).toBeGreaterThanOrEqual(9);
      expect(sobresale).toBeLessThanOrEqual(13);
      expect(cm.y).toBeGreaterThanOrEqual(0);

      const nombres = ["Panel", "Buscar", "Chats", "Perfil"];
      const cajas = await Promise.all(nombres.map(async (n) => (await barra(page).getByRole("link", { name: n, exact: true }).boundingBox())!));
      const [panel, buscar, chats, perfil] = cajas;
      expect(panel.x + panel.width).toBeLessThanOrEqual(buscar.x + 0.5);
      expect(buscar.x + buscar.width).toBeLessThanOrEqual(cm.x + 0.5); // dos a la izquierda
      expect(chats.x).toBeGreaterThanOrEqual(cm.x + cm.width - 0.5); // dos a la derecha
      expect(chats.x + chats.width).toBeLessThanOrEqual(perfil.x + 0.5);
      for (const c of cajas) {
        // Cada pestaña conserva su área táctil (44 px) y entra en la píldora.
        expect(c.width).toBeGreaterThanOrEqual(44);
        expect(c.x).toBeGreaterThanOrEqual(pildora.x - 0.5);
        expect(c.x + c.width).toBeLessThanOrEqual(pildora.x + pildora.width + 0.5);
      }
      // Los textos de las pestañas no se salen de su pestaña.
      for (const n of nombres) {
        const ok = await barra(page)
          .getByRole("link", { name: n, exact: true })
          .evaluate((el) => {
            const r = document.createRange();
            r.selectNodeContents(el);
            const t = r.getBoundingClientRect();
            const c = el.getBoundingClientRect();
            return t.left >= c.left - 0.5 && t.right <= c.right + 0.5;
          });
        expect(ok, n).toBe(true);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    });
  }
}

test("«+» al centro: azul hondo (no ámbar), con aro del color de la píldora, y el velo no lo corta ni lo lava", async ({ page }) => {
  await abrir(page, "employer", "/shifts");
  const mas = barra(page).getByRole("link", { name: "Publicar turno" });
  const estilo = await mas.evaluate((el) => {
    const c = getComputedStyle(el);
    const fondoPildora = getComputedStyle(el.closest("nav")!).backgroundColor;
    return { fondo: c.backgroundImage, sombra: c.boxShadow, fondoPildora };
  });
  expect(estilo.fondo).toContain("linear-gradient");
  expect(estilo.fondo).not.toMatch(/246, 169, 42|229, 142, 15|245, 158, 11|217, 119, 6|255, 171, 37/);
  expect(estilo.sombra).toContain(estilo.fondoPildora); // el aro
  // Píxeles reales: el centro del «+» es azul (no se lavó con el velo) y la
  // punta que sobresale por arriba de la píldora también.
  const c = (await mas.boundingBox())!;
  const [centro, punta] = await pixeles(page, [
    [Math.round(c.x + c.width / 2 - 14), Math.round(c.y + c.height / 2 + 10)],
    [Math.round(c.x + c.width / 2), Math.round(c.y + 3)],
  ]);
  for (const px of [centro, punta]) {
    expect(px[2]).toBeGreaterThan(px[0] + 30); // más azul que rojo
    expect(px[0]).toBeLessThan(120);
  }
});

test("«+» al centro: orden de teclado Panel, Buscar, +, Chats, Perfil y foco visible en el «+»", async ({ page }) => {
  await abrir(page, "employer", "/shifts");
  await barra(page).getByRole("link", { name: "Buscar", exact: true }).focus();
  const orden: string[] = [];
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("Tab");
    orden.push(await page.evaluate(() => (document.activeElement as HTMLElement).getAttribute("aria-label") ?? document.activeElement!.textContent ?? ""));
  }
  expect(orden).toEqual(["Publicar turno", "Chats", "Perfil"]);
  await barra(page).getByRole("link", { name: "Buscar", exact: true }).focus();
  await page.keyboard.press("Tab");
  const mas = barra(page).getByRole("link", { name: "Publicar turno" });
  await expect(mas).toBeFocused();
  const aro = await mas.evaluate((el) => {
    const c = getComputedStyle(el);
    return { estilo: c.outlineStyle, ancho: parseFloat(c.outlineWidth), offset: parseFloat(c.outlineOffset) };
  });
  expect(aro.estilo).toBe("solid");
  expect(aro.ancho).toBeGreaterThanOrEqual(2);
  expect(aro.offset).toBeGreaterThanOrEqual(5); // por fuera del aro de la píldora
});

test("barra de quien trabaja: cinco pestañas y ningún «+» (no cambia)", async ({ page }) => {
  await abrir(page, "worker", "/feed");
  await expect(barra(page).getByRole("link")).toHaveCount(5);
  await expect(barra(page).getByRole("link", { name: "Publicar turno" })).toHaveCount(0);
});
