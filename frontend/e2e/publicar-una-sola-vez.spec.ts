import { test, expect, type Page, type Route } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, skipSplash, enDias } from "./mocks";

/**
 * Un intento del asistente de publicar crea UN solo turno (2026-11-12).
 *
 * Publicar son dos pedidos: crear el borrador (`POST /shifts`) y publicarlo
 * (`POST /shifts/{id}/publish`). Antes el asistente se olvidaba del borrador
 * apenas lo creaba: si publicar fallaba —o se perdía la respuesta con mala
 * señal— el siguiente toque en «Publicar turno» creaba OTRO borrador y lo
 * publicaba. Quedaban dos turnos iguales publicados, o uno publicado y un
 * borrador suelto en el panel.
 *
 * Acá no alcanza con mirar la pantalla (en los dos casos termina diciendo
 * «¡Turno publicado!»): lo que se mide es qué le quedó al servidor. Por eso
 * la API simulada guarda los turnos y se comporta como el backend real ante
 * una `Idempotency-Key` repetida (`backend/app/core/idempotency.py`):
 * mismo pedido → devuelve la respuesta guardada sin ejecutar de nuevo;
 * misma clave con otro cuerpo → 422; un pedido que falló no guarda nada.
 */

const EMPLOYER = {
  id: "user-1",
  email: "comercio@oido.test",
  full_name: "Bar La Esquina",
  role: "employer",
  status: "activo",
  is_active: true,
  is_verified: true,
};

/** Cómo falla un pedido: no llega al servidor, llega y se pierde la
 * respuesta, o el servidor lo rechaza con ese código HTTP sin ejecutarlo. */
type Falla = "no-llega" | "respuesta-perdida" | number;

type Pedido = { metodo: string; ruta: string; clave: string | null; cuerpo: string };
type Turno = { estado: "borrador" | "publicado"; datos: Record<string, unknown> };
type Resultado = { status: number; respuesta: unknown };

async function servidorDeTurnos(
  page: Page,
  fallas: { crear?: Falla[]; editar?: Falla[]; publicar?: Falla[] } = {}
) {
  const pedidos: Pedido[] = [];
  const turnos = new Map<string, Turno>();
  const guardadas = new Map<string, { huella: string; resultado: Resultado }>();
  const fallasCrear = [...(fallas.crear ?? [])];
  const fallasEditar = [...(fallas.editar ?? [])];
  const fallasPublicar = [...(fallas.publicar ?? [])];

  const responder = (route: Route, { status, respuesta }: Resultado) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(respuesta),
    });

  function anotar(route: Route): Pedido {
    const req = route.request();
    const pedido = {
      metodo: req.method(),
      ruta: new URL(req.url()).pathname.replace("/api/v1", ""),
      clave: req.headers()["idempotency-key"] ?? null,
      cuerpo: req.postData() ?? "",
    };
    pedidos.push(pedido);
    return pedido;
  }

  /** Un pedido protegido por `Idempotency-Key`, con la falla que le toque. */
  async function atender(route: Route, falla: Falla | undefined, ejecutar: () => Resultado) {
    const { metodo, ruta, clave, cuerpo } = anotar(route);
    if (falla === "no-llega") return route.abort("failed");
    if (typeof falla === "number") {
      return responder(route, { status: falla, respuesta: { detail: `Rechazado (${falla})` } });
    }
    const huella = `${metodo} ${ruta} ${cuerpo}`;
    const previa = clave ? guardadas.get(clave) : undefined;
    if (previa && previa.huella !== huella) {
      return responder(route, {
        status: 422,
        respuesta: { detail: "Esta Idempotency-Key ya se usó con un pedido distinto" },
      });
    }
    const resultado = previa?.resultado ?? ejecutar();
    if (clave && !previa && resultado.status < 400) guardadas.set(clave, { huella, resultado });
    if (falla === "respuesta-perdida") return route.abort("failed");
    return responder(route, resultado);
  }

  // Lo que no es de este flujo (perfil del local, avisos, sesión) no sale a
  // la red. Los handlers de abajo se registran después y ganan.
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: route.request().method() === "GET" ? "[]" : "{}",
    })
  );
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) =>
    responder(route, { status: 200, respuesta: EMPLOYER })
  );

  await page.route("**/api/v1/shifts", (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    return atender(route, fallasCrear.shift(), () => {
      const id = `turno-${turnos.size + 1}`;
      turnos.set(id, { estado: "borrador", datos: route.request().postDataJSON() });
      return { status: 201, respuesta: { id, status: "borrador" } };
    });
  });

  await page.route(/\/api\/v1\/shifts\/turno-\d+$/, (route) => {
    if (route.request().method() !== "PUT") return route.fallback();
    const { ruta } = anotar(route);
    const falla = fallasEditar.shift();
    if (falla === "no-llega") return route.abort("failed");
    const id = ruta.split("/")[2];
    const turno = turnos.get(id);
    if (!turno) return responder(route, { status: 404, respuesta: { detail: "Turno no encontrado" } });
    turno.datos = route.request().postDataJSON();
    if (falla === "respuesta-perdida") return route.abort("failed");
    return responder(route, { status: 200, respuesta: { id, status: turno.estado } });
  });

  await page.route(/\/api\/v1\/shifts\/turno-\d+\/publish$/, (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-2)!;
    return atender(route, fallasPublicar.shift(), () => {
      const turno = turnos.get(id);
      if (!turno) return { status: 404, respuesta: { detail: "Turno no encontrado" } };
      if (turno.estado !== "borrador") {
        return { status: 400, respuesta: { detail: "El turno ya no está en borrador" } };
      }
      turno.estado = "publicado";
      return { status: 200, respuesta: { id, status: "publicado" } };
    });
  });

  return {
    turnos,
    /** Los pedidos de este flujo, en orden: `"POST /shifts"`, etc. */
    recorrido: () => pedidos.map((p) => `${p.metodo} ${p.ruta}`),
    de: (metodo: string, ruta: string) =>
      pedidos.filter((p) => p.metodo === metodo && p.ruta === ruta),
  };
}

const botonPublicar = (page: Page) => page.getByRole("button", { name: "Publicar turno" });

/** Completa el asistente hasta el último paso, con $15.000 de pago. */
async function llegarAPublicar(page: Page) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await page.goto("/shifts/new");

  await page.getByRole("button", { name: "Mozo/a" }).click();
  await page.locator('input[type="datetime-local"]').first().fill(enDias(30, "20:00"));
  await page.locator('input[type="datetime-local"]').nth(1).fill(enDias(30, "23:00"));
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByPlaceholder("48000").fill("15000");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.locator("select").nth(1).selectOption("Palermo");
  await expect(botonPublicar(page)).toBeEnabled();
}

/** Un intento que termina en error: aviso a la vista y botón otra vez libre. */
async function intentarYFallar(page: Page, aviso: string | RegExp = "No se pudo publicar") {
  await botonPublicar(page).click();
  await expect(page.getByText(aviso).first()).toBeVisible();
  await expect(botonPublicar(page)).toBeEnabled();
}

async function cambiarElPago(page: Page, monto: string) {
  await page.getByRole("button", { name: "Atrás" }).click();
  await page.getByPlaceholder("48000").fill(monto);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(botonPublicar(page)).toBeEnabled();
}

const FALLAS_AL_PUBLICAR: { caso: string; falla: Falla }[] = [
  // El caso de la mala señal: el servidor publicó, la respuesta no volvió.
  { caso: "se pierde la respuesta de publicar", falla: "respuesta-perdida" },
  { caso: "el pedido de publicar no llega", falla: "no-llega" },
  { caso: "el servidor falla al publicar", falla: 500 },
];

for (const { caso, falla } of FALLAS_AL_PUBLICAR) {
  test(`${caso}: reintentar publica el mismo turno, no crea otro`, async ({ page }) => {
    const servidor = await servidorDeTurnos(page, { publicar: [falla] });
    await llegarAPublicar(page);

    await intentarYFallar(page, falla === 500 ? "Rechazado (500)" : "No se pudo publicar");
    await botonPublicar(page).click();
    await expect(page.getByText("¡Turno publicado!")).toBeVisible();

    // Un solo borrador, y el segundo publicar va al mismo turno con la misma
    // clave: si el primero había llegado, el servidor devuelve lo que ya hizo.
    expect(servidor.recorrido()).toEqual([
      "POST /shifts",
      "POST /shifts/turno-1/publish",
      "POST /shifts/turno-1/publish",
    ]);
    const [primero, segundo] = servidor.de("POST", "/shifts/turno-1/publish");
    expect(primero.clave).toBeTruthy();
    expect(segundo.clave).toBe(primero.clave);
    expect([...servidor.turnos.values()].map((t) => t.estado)).toEqual(["publicado"]);
  });
}

test("se pierde la respuesta de crear: el reintento repite el mismo pedido con la misma clave", async ({
  page,
}) => {
  const servidor = await servidorDeTurnos(page, { crear: ["respuesta-perdida"] });
  await llegarAPublicar(page);

  await intentarYFallar(page);
  await botonPublicar(page).click();
  await expect(page.getByText("¡Turno publicado!")).toBeVisible();

  expect(servidor.recorrido()).toEqual([
    "POST /shifts",
    "POST /shifts",
    "POST /shifts/turno-1/publish",
  ]);
  const [primero, segundo] = servidor.de("POST", "/shifts");
  expect(primero.clave).toBeTruthy();
  expect(segundo.clave).toBe(primero.clave);
  expect(segundo.cuerpo).toBe(primero.cuerpo);
  expect([...servidor.turnos.values()].map((t) => t.estado)).toEqual(["publicado"]);
});

test("si cambia el formulario después del primer intento, se actualiza el borrador antes de publicar", async ({
  page,
}) => {
  const servidor = await servidorDeTurnos(page, { publicar: ["no-llega"] });
  await llegarAPublicar(page);

  await intentarYFallar(page);
  await cambiarElPago(page, "18000");
  await botonPublicar(page).click();
  await expect(page.getByText("¡Turno publicado!")).toBeVisible();

  expect(servidor.recorrido()).toEqual([
    "POST /shifts",
    "POST /shifts/turno-1/publish",
    "PUT /shifts/turno-1",
    "POST /shifts/turno-1/publish",
  ]);
  // Lo que queda publicado es lo último que la persona vio en el resumen.
  const turnos = [...servidor.turnos.values()];
  expect(turnos).toHaveLength(1);
  expect(turnos[0].estado).toBe("publicado");
  expect(turnos[0].datos.pay_amount).toBe("18000");
});

test("si se pierde la respuesta de una edición, el borrador se vuelve a guardar antes de publicar", async ({
  page,
}) => {
  const servidor = await servidorDeTurnos(page, {
    publicar: ["no-llega"],
    editar: ["respuesta-perdida"],
  });
  await llegarAPublicar(page);

  await intentarYFallar(page);
  // Sube el pago: el servidor lo guarda, pero la respuesta no vuelve.
  await cambiarElPago(page, "18000");
  await intentarYFallar(page);
  // Se arrepiente y vuelve al pago original. El asistente no sabe qué quedó
  // guardado, así que no puede dar por bueno lo que mandó al crear.
  await cambiarElPago(page, "15000");
  await botonPublicar(page).click();
  await expect(page.getByText("¡Turno publicado!")).toBeVisible();

  expect(servidor.recorrido()).toEqual([
    "POST /shifts",
    "POST /shifts/turno-1/publish",
    "PUT /shifts/turno-1",
    "PUT /shifts/turno-1",
    "POST /shifts/turno-1/publish",
  ]);
  const turnos = [...servidor.turnos.values()];
  expect(turnos).toHaveLength(1);
  expect(turnos[0].estado).toBe("publicado");
  expect(turnos[0].datos.pay_amount).toBe("15000");
});

test("respuesta de crear perdida y formulario cambiado: recupera el borrador y lo actualiza", async ({
  page,
}) => {
  const servidor = await servidorDeTurnos(page, { crear: ["respuesta-perdida"] });
  await llegarAPublicar(page);

  await intentarYFallar(page);
  await cambiarElPago(page, "18000");
  await botonPublicar(page).click();
  await expect(page.getByText("¡Turno publicado!")).toBeVisible();

  // No se sabe si el borrador se creó: se repite el pedido ORIGINAL (misma
  // clave, mismo cuerpo) para que el servidor devuelva el que ya tiene, y el
  // cambio va después como edición. Con la misma clave y el cuerpo nuevo el
  // servidor responde 422 y el asistente queda trabado.
  expect(servidor.recorrido()).toEqual([
    "POST /shifts",
    "POST /shifts",
    "PUT /shifts/turno-1",
    "POST /shifts/turno-1/publish",
  ]);
  const [primero, segundo] = servidor.de("POST", "/shifts");
  expect(segundo.clave).toBe(primero.clave);
  expect(segundo.cuerpo).toBe(primero.cuerpo);
  const turnos = [...servidor.turnos.values()];
  expect(turnos).toHaveLength(1);
  expect(turnos[0].estado).toBe("publicado");
  expect(turnos[0].datos.pay_amount).toBe("18000");
});

test("si el servidor rechaza los datos al crear, el reintento manda el formulario corregido", async ({
  page,
}) => {
  const servidor = await servidorDeTurnos(page, { crear: [400] });
  await llegarAPublicar(page);

  await intentarYFallar(page, "Rechazado (400)");
  await cambiarElPago(page, "18000");
  await botonPublicar(page).click();
  await expect(page.getByText("¡Turno publicado!")).toBeVisible();

  // El rechazo fue una respuesta del servidor: no creó nada, así que no hay
  // borrador que recuperar y el pedido nuevo lleva los datos nuevos.
  expect(servidor.recorrido()).toEqual([
    "POST /shifts",
    "POST /shifts",
    "POST /shifts/turno-1/publish",
  ]);
  const turnos = [...servidor.turnos.values()];
  expect(turnos).toHaveLength(1);
  expect(turnos[0].estado).toBe("publicado");
  expect(turnos[0].datos.pay_amount).toBe("18000");
});

test("con el tope del plan el borrador queda guardado y el asistente lleva al panel", async ({
  page,
}) => {
  const servidor = await servidorDeTurnos(page, { publicar: [402] });
  await llegarAPublicar(page);

  await botonPublicar(page).click();
  await expect(page.getByText("Llegaste al límite de tu plan")).toBeVisible();
  await page.getByRole("button", { name: "Ahora no" }).click();
  await expect(page).toHaveURL("/shifts");

  expect(servidor.recorrido()).toEqual(["POST /shifts", "POST /shifts/turno-1/publish"]);
  expect([...servidor.turnos.values()].map((t) => t.estado)).toEqual(["borrador"]);
});
