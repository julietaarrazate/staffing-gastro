// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { claveDeTurno, conCacheDeTurno, TTL_SEGUNDOS } from "./turno-cache.mjs";

const ID = "04c36513-c114-43e8-ad9c-8dfcd33d1580";
const URL_TURNO = `https://www.oido.com.ar/turno/${ID}`;

function cacheFalsa() {
  const datos = new Map<string, Response>();
  return {
    datos,
    match: vi.fn(async (k: Request) => datos.get(k.url)?.clone()),
    put: vi.fn(async (k: Request, r: Response) => {
      datos.set(k.url, r);
    }),
  };
}

function ctxFalso() {
  const pendientes: Promise<unknown>[] = [];
  return { pendientes, waitUntil: (p: Promise<unknown>) => pendientes.push(p) };
}

describe("claveDeTurno", () => {
  it("usa sólo la ruta, sin la consulta", () => {
    expect(claveDeTurno(new Request(`${URL_TURNO}?ref=wa`))?.url).toBe(URL_TURNO);
  });

  it("no cachea otras rutas, otros métodos ni la navegación RSC", () => {
    expect(claveDeTurno(new Request("https://www.oido.com.ar/feed"))).toBeNull();
    expect(claveDeTurno(new Request("https://www.oido.com.ar/turno/no-es-uuid"))).toBeNull();
    expect(claveDeTurno(new Request(URL_TURNO, { method: "POST" }))).toBeNull();
    expect(claveDeTurno(new Request(URL_TURNO, { headers: { RSC: "1" } }))).toBeNull();
    expect(claveDeTurno(new Request(`${URL_TURNO}?_rsc=abc`))).toBeNull();
  });
});

describe("conCacheDeTurno", () => {
  it("arma la página una vez y la segunda visita sale de la caché", async () => {
    const cache = cacheFalsa();
    const handler = { fetch: vi.fn(async () => new Response("<html>turno</html>", { status: 200 })) };
    const fetch = conCacheDeTurno(handler, () => cache);

    const ctx1 = ctxFalso();
    const r1 = await fetch(new Request(URL_TURNO), {}, ctx1);
    await Promise.all(ctx1.pendientes);
    expect(await r1.text()).toBe("<html>turno</html>");
    expect(r1.headers.get("Cache-Control")).toBe(`public, max-age=${TTL_SEGUNDOS}`);

    const r2 = await fetch(new Request(`${URL_TURNO}?ref=wa`), {}, ctxFalso());
    expect(await r2.text()).toBe("<html>turno</html>");
    expect(handler.fetch).toHaveBeenCalledTimes(1);
  });

  it("no guarda un 404 ni una respuesta con Set-Cookie", async () => {
    const cache = cacheFalsa();
    const respuestas = [
      new Response("no está", { status: 404 }),
      new Response("ok", { status: 200, headers: { "Set-Cookie": "a=b" } }),
    ];
    const handler = { fetch: vi.fn(async () => respuestas.shift()!) };
    const fetch = conCacheDeTurno(handler, () => cache);

    await fetch(new Request(URL_TURNO), {}, ctxFalso());
    await fetch(new Request(URL_TURNO), {}, ctxFalso());
    expect(cache.put).not.toHaveBeenCalled();
  });

  it("sin caché disponible (workers.dev, pruebas) pasa derecho", async () => {
    const handler = { fetch: vi.fn(async () => new Response("ok")) };
    const fetch = conCacheDeTurno(handler, () => undefined);
    await fetch(new Request(URL_TURNO), {}, ctxFalso());
    expect(handler.fetch).toHaveBeenCalledTimes(1);
  });
});
