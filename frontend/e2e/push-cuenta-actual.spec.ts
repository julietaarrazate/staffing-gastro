import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, GUIDED_TOUR_KEYS, mockEmptyNotifications, skipSplash } from "./mocks";

/**
 * Las notificaciones de un dispositivo son de la cuenta que tiene la sesión
 * abierta ahí (docs/reference/ACCESO_MODERNO.md). En un navegador compartido
 * la suscripción quedaba a nombre de quien la activó primero: después de
 * cerrar sesión el dispositivo seguía recibiendo sus avisos, y la cuenta
 * siguiente veía el interruptor "Activadas" sin recibir nada.
 *
 * La baja (`POST /push/release`) no lleva el token de la sesión: se prueba
 * con la clave de la suscripción, así que sirve con el token vencido, y si
 * no llega queda pendiente y se reintenta (`/privacidad`: el identificador
 * se borra al cerrar sesión en ese dispositivo).
 *
 * El navegador de la prueba ya había activado las notificaciones: tiene el
 * service worker registrado, el permiso concedido y una suscripción. Headless
 * no tiene servicio push, así que la suscripción y el permiso se simulan; el
 * registro del service worker, el ingreso y el cierre de sesión son los reales.
 */

const ENDPOINT = "https://fcm.googleapis.com/fcm/send/navegador-e2e";
const SUBSCRIPTION = { endpoint: ENDPOINT, keys: { p256dh: "clave-p256dh", auth: "clave-auth" } };

const CUENTAS = {
  "primera@example.com": { token: "token-de-la-primera", id: "user-primera", role: "worker" },
  "segunda@example.com": { token: "token-de-la-segunda", id: "user-segunda", role: "worker" },
  "admin@example.com": { token: "token-de-la-admin", id: "user-admin", role: "admin" },
} as const;
type Email = keyof typeof CUENTAS;

/** La cuenta que la admin mira con «Ver como». */
const VISTA = {
  id: "user-vista",
  email: "vista@example.com",
  full_name: "Persona vista",
  role: "worker",
  status: "activo",
  is_active: true,
  is_verified: true,
};
const TOKEN_IMPERSONADO = "token-impersonado";

/** El 403 con código que recibe una admin sin la verificación en dos pasos. */
const CANDADO_ALTA = {
  detail: {
    code: "two_factor_setup_required",
    message: "Activá la verificación en dos pasos para usar el panel de admin.",
  },
};

interface PushCall {
  /** "POST /push/subscribe" (el registro) o "POST /push/release" (la baja). */
  request: string;
  authorization: string | undefined;
  body: unknown;
}

/** La baja del dispositivo para una cuenta, como la manda este navegador. */
function bajaDe(email: Email): PushCall {
  return {
    request: "POST /push/release",
    authorization: undefined,
    body: { endpoint: ENDPOINT, auth: SUBSCRIPTION.keys.auth, user_id: CUENTAS[email].id },
  };
}

function altaDe(email: Email): PushCall {
  return {
    request: "POST /push/subscribe",
    authorization: `Bearer ${CUENTAS[email].token}`,
    body: SUBSCRIPTION,
  };
}

function json(body: unknown, status = 200) {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

function usuario(email: Email) {
  return {
    id: CUENTAS[email].id,
    email,
    full_name: "Cuenta de prueba",
    role: CUENTAS[email].role,
    status: "activo",
    is_active: true,
    is_verified: true,
  };
}

/** `candado`: el backend de una admin que todavía no activó la verificación
 * en dos pasos, que le contesta ese 403 a todo lo que pida con su sesión
 * menos el ingreso y el alta. `bajaRetenida`: la baja no contesta hasta que
 * esa promesa se resuelva (una red trabada). `red.caida`: mientras sea
 * `true`, la baja no llega al servidor. `sesion.muerta`: el servidor ya no
 * reconoce ninguna sesión (venció o la revocaron). */
async function mockBackend(
  page: Page,
  {
    candado = false,
    bajaRetenida,
    red = { caida: false },
    sesion = { muerta: false },
  }: {
    candado?: boolean;
    bajaRetenida?: Promise<void>;
    red?: { caida: boolean };
    sesion?: { muerta: boolean };
  } = {}
): Promise<PushCall[]> {
  const pushCalls: PushCall[] = [];

  // Lo que no importa para esta prueba (las pantallas a las que cae el
  // ingreso) contesta 404 en vez de salir a la red. El candado es sólo para
  // pedidos con sesión: lo público (la landing) nunca lo recibe.
  await page.route("**/api/v1/**", async (route) => {
    const conSesion = (await route.request().headerValue("authorization")) != null;
    return route.fulfill(
      candado && conSesion ? json(CANDADO_ALTA, 403) : json({ detail: "sin mock" }, 404)
    );
  });
  if (!candado) await mockEmptyNotifications(page);
  // Las cuentas ya tienen su perfil: el ingreso lo consulta y un 404 lo
  // mandaría a la bienvenida (G12).
  if (!candado)
    await page.route("**/api/v1/workers/me/profile", (route) =>
      route.fulfill(
        json({
          id: "p1", full_name: "Persona", photo_url: null, birth_date: null, age: null, city: "Palermo",
          latitude: -34.58, longitude: -58.43, bio: null, skills: ["mozo"], years_experience: 1,
          languages: [], certifications: [], cv_url: null, cv_filename: null, is_available: true,
        }, 200)
      )
    );

  await page.route("**/api/v1/auth/login", (route) => {
    const { email } = route.request().postDataJSON() as { email: Email };
    return route.fulfill(json({ access_token: CUENTAS[email].token, token_type: "bearer" }));
  });
  await page.route("**/api/v1/auth/me", async (route) => {
    const authorization = await route.request().headerValue("authorization");
    const email = (Object.keys(CUENTAS) as Email[]).find(
      (e) => authorization === `Bearer ${CUENTAS[e].token}`
    );
    return email && !sesion.muerta
      ? route.fulfill(json(usuario(email)))
      : route.fulfill(json({ detail: "No autorizado" }, 401));
  });
  await page.route("**/api/v1/auth/refresh", (route) =>
    route.fulfill(json({ detail: "No autorizado" }, 401))
  );
  await page.route("**/api/v1/auth/logout", (route) => route.fulfill({ status: 204 }));

  await page.route("**/api/v1/push/subscribe", async (route) => {
    const request = route.request();
    pushCalls.push({
      request: `${request.method()} /push/subscribe`,
      authorization: (await request.headerValue("authorization")) ?? undefined,
      body: request.postDataJSON(),
    });
    if (candado) return route.fulfill(json(CANDADO_ALTA, 403));
    return route.fulfill(json({ ok: true }, 201));
  });
  // La baja es pública: no lleva sesión, así que el candado no la alcanza.
  await page.route("**/api/v1/push/release", async (route) => {
    const request = route.request();
    pushCalls.push({
      request: `${request.method()} /push/release`,
      authorization: (await request.headerValue("authorization")) ?? undefined,
      body: request.postDataJSON(),
    });
    if (red.caida) return route.abort("internetdisconnected");
    // Contesta con la demora de un backend de verdad: cuando el cierre de
    // sesión ya llevó a la landing.
    if (candado) await new Promise((resolve) => setTimeout(resolve, 400));
    await bajaRetenida;
    return route.fulfill({ status: 204 });
  });

  return pushCalls;
}

/** El navegador ya había activado las notificaciones antes de la prueba:
 * permiso concedido y una suscripción (simulados, ver arriba). El service
 * worker se registra de verdad con `registrarServiceWorker`. */
async function navegadorConPushActivado(page: Page) {
  await page.addInitScript(
    ({ subscription, tourKeys }) => {
      for (const key of tourKeys) window.localStorage.setItem(key, "1");
      Object.defineProperty(Notification, "permission", { configurable: true, get: () => "granted" });
      let cancelled = false;
      PushManager.prototype.getSubscription = async () =>
        cancelled
          ? null
          : ({
              endpoint: subscription.endpoint,
              toJSON: () => subscription,
              unsubscribe: async () => (cancelled = true),
            } as unknown as PushSubscription);
    },
    { subscription: SUBSCRIPTION, tourKeys: GUIDED_TOUR_KEYS }
  );
}

/** Lo que quedó anotado en `localStorage` como baja pendiente (`null` = nada). */
function bajasPendientes(page: Page) {
  return page.evaluate(() => window.localStorage.getItem("staffya_push_release_pending"));
}

async function registrarServiceWorker(page: Page) {
  await page.goto("/login");
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
  });
}

async function ingresar(page: Page, email: Email, destino = /\/feed$/) {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Contraseña").fill("una-clave-cualquiera");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(destino);
}

test("el push pasa a la cuenta que entra y se da de baja al cerrar sesión", async ({ page }) => {
  await blockExternalHosts(page);
  await skipSplash(page);
  const pushCalls = await mockBackend(page);
  await navegadorConPushActivado(page);

  // El navegador ya tenía las notificaciones activadas de antes.
  await registrarServiceWorker(page);
  expect(pushCalls).toEqual([]); // sin sesión no se registra nada

  // Entra la primera cuenta: el dispositivo queda a su nombre, sin tocar nada.
  await ingresar(page, "primera@example.com");
  const altaDeLaPrimera = altaDe("primera@example.com");
  await expect.poll(() => pushCalls).toEqual([altaDeLaPrimera]);

  // Abrir la app con la sesión guardada lo vuelve a registrar (idempotente).
  await page.goto("/profile/settings");
  await expect(page.getByRole("button", { name: /Notificaciones push.*Activadas/ })).toBeVisible();
  await expect.poll(() => pushCalls).toEqual([altaDeLaPrimera, altaDeLaPrimera]);

  // Cierra sesión: el dispositivo se da de baja en el servidor, sin el token
  // (con la clave de la suscripción y la cuenta que sale), y la suscripción
  // del navegador queda.
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => pushCalls.at(-1)).toEqual(bajaDe("primera@example.com"));
  expect(pushCalls).toHaveLength(3);
  // Llegó: no queda nada pendiente.
  await expect.poll(() => bajasPendientes(page)).toBeNull();

  // Entra otra cuenta en el mismo navegador: el dispositivo pasa a ser suyo.
  await ingresar(page, "segunda@example.com");
  await expect.poll(() => pushCalls.at(-1)).toEqual(altaDe("segunda@example.com"));
  expect(pushCalls).toHaveLength(4);
});

test("cerrar sesión sin conexión: la baja queda pendiente y sale sola al volver a abrir la app", async ({
  page,
}) => {
  await blockExternalHosts(page);
  await skipSplash(page);
  const red = { caida: false };
  const pushCalls = await mockBackend(page, { red });
  await navegadorConPushActivado(page);
  await registrarServiceWorker(page);
  await ingresar(page, "primera@example.com");
  await expect.poll(() => pushCalls).toEqual([altaDe("primera@example.com")]);

  // Sale sin red: la baja no llega y el cierre sigue igual.
  red.caida = true;
  await page.getByRole("link", { name: "Perfil", exact: true }).click();
  await page.getByRole("link", { name: "Ajustes" }).click();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect
    .poll(() => pushCalls)
    .toEqual([altaDe("primera@example.com"), bajaDe("primera@example.com")]);
  // Queda anotada sólo la cuenta: ni el endpoint ni la clave se guardan.
  await expect.poll(() => bajasPendientes(page)).toBe(JSON.stringify(["user-primera"]));

  // Vuelve la red y se abre la app de nuevo (sin sesión): la baja sale sola.
  red.caida = false;
  await page.goto("/");
  await expect
    .poll(() => pushCalls)
    .toEqual([
      altaDe("primera@example.com"),
      bajaDe("primera@example.com"),
      bajaDe("primera@example.com"),
    ]);
  await expect.poll(() => bajasPendientes(page)).toBeNull();
});

test("la misma cuenta vuelve a entrar con su baja pendiente: se descarta y el dispositivo queda suyo", async ({
  page,
}) => {
  await blockExternalHosts(page);
  await skipSplash(page);
  const red = { caida: true };
  const pushCalls = await mockBackend(page, { red });
  await navegadorConPushActivado(page);
  await registrarServiceWorker(page);
  await ingresar(page, "primera@example.com");
  await page.getByRole("link", { name: "Perfil", exact: true }).click();
  await page.getByRole("link", { name: "Ajustes" }).click();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => bajasPendientes(page)).toBe(JSON.stringify(["user-primera"]));
  const antes = pushCalls.length;

  // Vuelve la red y entra la misma cuenta, sin recargar: si la baja pendiente
  // saliera ahora, le borraría el registro que acaba de hacer.
  red.caida = false;
  await page.getByRole("link", { name: "Ingresar" }).first().click();
  await page.getByPlaceholder("Email").fill("primera@example.com");
  await page.getByPlaceholder("Contraseña").fill("una-clave-cualquiera");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/feed$/);

  await expect.poll(() => pushCalls.slice(antes)).toEqual([altaDe("primera@example.com")]);
  await expect.poll(() => bajasPendientes(page)).toBeNull();
  // Ni al volver la conexión ni al volver la pestaña sale una baja.
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForTimeout(300);
  expect(pushCalls.slice(antes)).toEqual([altaDe("primera@example.com")]);
});

test("la sesión que vence sola también da de baja el dispositivo", async ({ page }) => {
  await blockExternalHosts(page);
  await skipSplash(page);
  const sesion = { muerta: false };
  const pushCalls = await mockBackend(page, { sesion });
  await navegadorConPushActivado(page);
  await registrarServiceWorker(page);
  await ingresar(page, "primera@example.com");
  await expect.poll(() => pushCalls).toEqual([altaDe("primera@example.com")]);

  // Pasaron los días (o el servidor revocó la sesión): al abrir la app el
  // servidor ya no la reconoce. No hay token que sirva para la baja, y no
  // hace falta.
  sesion.muerta = true;
  await page.goto("/feed");
  await expect(page).toHaveURL(/\/login\?motivo=vencida/);

  await expect.poll(() => pushCalls.at(-1)).toEqual(bajaDe("primera@example.com"));
  await expect.poll(() => bajasPendientes(page)).toBeNull();
  // Sólo bajas de esa cuenta (si la recarga cortó la primera, se reintentó).
  expect(pushCalls.slice(1).every((call) => call.request === "POST /push/release")).toBe(true);
});

test("quien sale y vuelve a entrar con la baja todavía en camino no se queda sin avisos", async ({
  page,
}) => {
  await blockExternalHosts(page);
  await skipSplash(page);
  let soltarLaBaja = () => {};
  const bajaRetenida = new Promise<void>((resolve) => (soltarLaBaja = resolve));
  const pushCalls = await mockBackend(page, { bajaRetenida });
  await navegadorConPushActivado(page);
  await registrarServiceWorker(page);
  const pedidos = () => pushCalls.map((call) => call.request);

  await ingresar(page, "primera@example.com");
  await expect.poll(pedidos).toEqual(["POST /push/subscribe"]);

  // Sale: la baja queda en camino, sin contestar. De acá en más no se recarga
  // la página, como en la app instalada.
  await page.getByRole("link", { name: "Perfil", exact: true }).click();
  await page.getByRole("link", { name: "Ajustes" }).click();
  await page.evaluate(() => ((window as unknown as { sinRecargar: boolean }).sinRecargar = true));
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(pedidos).toEqual(["POST /push/subscribe", "POST /push/release"]);

  // Vuelve a entrar la misma cuenta. El registro no puede llegar antes que la
  // baja: el servidor borraría la fila recién creada y Ajustes diría
  // «Activadas» sin que llegue nada.
  await page.getByRole("link", { name: "Ingresar" }).first().click();
  await page.getByPlaceholder("Email").fill("primera@example.com");
  await page.getByPlaceholder("Contraseña").fill("una-clave-cualquiera");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/feed$/);
  expect(
    await page.evaluate(() => (window as unknown as { sinRecargar?: boolean }).sinRecargar)
  ).toBe(true);
  await page.waitForTimeout(500);
  expect(pedidos()).toHaveLength(2);

  // La baja termina y recién ahí sale el registro de la sesión nueva.
  soltarLaBaja();
  await expect
    .poll(pedidos)
    .toEqual(["POST /push/subscribe", "POST /push/release", "POST /push/subscribe"]);
  expect(pushCalls.at(-1)).toEqual(altaDe("primera@example.com"));
});

test("en «Ver como» el dispositivo sigue siendo de la admin y Ajustes no deja cambiarlo", async ({
  page,
}) => {
  await blockExternalHosts(page);
  await skipSplash(page);
  const pushCalls = await mockBackend(page);
  await page.route("**/api/v1/admin/test-accounts", (route) => route.fulfill(json([VISTA])));
  await page.route(`**/api/v1/admin/users/${VISTA.id}/impersonate`, (route) =>
    route.fulfill(json({ access_token: TOKEN_IMPERSONADO, token_type: "bearer", user: VISTA }))
  );
  await page.route("**/api/v1/shifts/feed", (route) => route.fulfill(json([])));
  await page.route("**/api/v1/applications/mine", (route) => route.fulfill(json([])));
  await navegadorConPushActivado(page);
  await registrarServiceWorker(page);

  // La admin entra: el dispositivo queda a su nombre.
  await ingresar(page, "admin@example.com", /\/admin/);
  const altaDeLaAdmin = altaDe("admin@example.com");
  await expect.poll(() => pushCalls).toEqual([altaDeLaAdmin]);

  // «Ver como» y, ya como esa persona, hasta Ajustes (sin recargar: la
  // impersonación vive en memoria).
  await page.getByRole("link", { name: "Herramientas" }).first().click();
  await page.getByRole("button", { name: "Ver como trabajador" }).click();
  await expect(page).toHaveURL(/\/feed$/);
  await expect(page.getByRole("status").filter({ hasText: "Viendo como" })).toBeVisible();
  await page.getByRole("link", { name: "Perfil", exact: true }).click();
  await page.getByRole("link", { name: "Ajustes" }).click();
  await expect(page).toHaveURL(/\/profile\/settings$/);

  // El interruptor muestra el estado del navegador de la admin, deshabilitado
  // y con la explicación.
  const interruptor = page.getByRole("button", { name: /Notificaciones push.*Activadas/ });
  await expect(interruptor).toBeDisabled();
  await expect(interruptor).toHaveAccessibleDescription(
    "Mientras ves la app como otra persona no se pueden cambiar las notificaciones de este dispositivo."
  );
  await expect(
    page.getByText("Mientras ves la app como otra persona no se pueden cambiar")
  ).toBeVisible();
  await interruptor.click({ force: true });

  // Volver a la cuenta admin tampoco manda nada: en todo el recorrido, ni un
  // pedido con el token de la persona vista y ninguna baja.
  await page.getByRole("button", { name: "Volver a admin" }).click();
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByRole("status").filter({ hasText: "Viendo como" })).toHaveCount(0);
  expect(pushCalls).toEqual([altaDeLaAdmin]);
});

test.describe("admin con el alta de la verificación en dos pasos pendiente", () => {
  // "Salir" está en el encabezado desde 768 px; con el alta pendiente es la
  // única salida a mano (cualquier otra pantalla vuelve al alta).
  test.use({ viewport: { width: 1280, height: 800 } });

  test("el push no la lleva al alta antes de tiempo ni la devuelve ahí al salir", async ({
    page,
  }) => {
    await blockExternalHosts(page);
    await skipSplash(page);
    const pushCalls = await mockBackend(page, { candado: true });
    await page.route("**/api/v1/auth/2fa", (route) =>
      route.fulfill(json({ enabled: false, enabled_at: null, recovery_codes_left: 0 }))
    );
    const cierres: string[] = [];
    page.on("request", (request) => {
      if (request.url().endsWith("/api/v1/auth/logout")) cierres.push(request.method());
    });
    await navegadorConPushActivado(page);
    await registrarServiceWorker(page);

    // Entra y el panel la manda al alta, como siempre. El registro del push
    // salió una vez, el backend lo rechazó y no se repite.
    await ingresar(page, "admin@example.com", /\/admin\/seguridad$/);
    await expect(page.getByRole("button", { name: "Activar la verificación" })).toBeVisible();
    await expect.poll(() => pushCalls).toEqual([altaDe("admin@example.com")]);

    // Sale sin activar nada: la baja no lleva la sesión (el candado no la
    // alcanza), contesta con la sesión ya cerrada y no la devuelve al alta.
    const pantallas: string[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) pantallas.push(new URL(frame.url()).pathname);
    });
    const baja = page.waitForResponse((response) =>
      response.url().endsWith("/api/v1/push/release")
    );
    await page.getByRole("button", { name: /^Salir/ }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("link", { name: "Ingresar" }).first()).toBeVisible();
    expect((await baja).status()).toBe(204);
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/$/);
    expect(pantallas).not.toContain("/admin/seguridad");
    expect(cierres).toEqual(["POST"]);
    expect(pushCalls).toEqual([altaDe("admin@example.com"), bajaDe("admin@example.com")]);
  });
});
