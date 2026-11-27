// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { claveDeSitemap, conCacheDeSitemap, VIGENCIA_SEGUNDOS } from "./sitemap-cache.mjs";

const URL_MAPA = "https://www.oido.com.ar/sitemap.xml";

function cacheFalsa() {
  const datos = new Map<string, Response>();
  return {
    datos,
    match: vi.fn(async (k: Request) => datos.get(k.url)?.clone()),
    put: vi.fn(async (k: Request, r: Response) => {
      datos.set(k.url, r);
    }),
    delete: vi.fn(async (k: Request) => datos.delete(k.url)),
  };
}
const ctxFalso = () => {
  const pendientes: Promise<unknown>[] = [];
  return { pendientes, waitUntil: (p: Promise<unknown>) => pendientes.push(p) };
};

describe("claveDeSitemap", () => {
  it("sólo el GET de /sitemap.xml, sin la consulta", () => {
    expect(claveDeSitemap(new Request(`${URL_MAPA}?x=1`))?.url).toBe(URL_MAPA);
    expect(claveDeSitemap(new Request(URL_MAPA, { method: "POST" }))).toBeNull();
    expect(claveDeSitemap(new Request("https://www.oido.com.ar/robots.txt"))).toBeNull();
  });
});

describe("conCacheDeSitemap", () => {
  const xml = () => new Response("<urlset/>", { headers: { "Content-Type": "application/xml" } });

  it("el segundo pedido sale de la caché y no llama al origen", async () => {
    let t = 1_000_000;
    const handler = { fetch: vi.fn(async () => xml()) };
    const cache = cacheFalsa();
    const w = conCacheDeSitemap(handler, () => cache, () => t);
    const ctx = ctxFalso();

    const a = await w.fetch(new Request(URL_MAPA), {}, ctx);
    await Promise.all(ctx.pendientes);
    t += 5_000;
    const b = await w.fetch(new Request(URL_MAPA), {}, ctx);

    expect(await a.text()).toBe("<urlset/>");
    expect(await b.text()).toBe("<urlset/>");
    expect(handler.fetch).toHaveBeenCalledTimes(1);
    expect(b.headers.get("X-Oido-Armada")).toBeNull();
  });

  it("pasados 10 minutos se arma de nuevo", async () => {
    let t = 1_000_000;
    const handler = { fetch: vi.fn(async () => xml()) };
    const cache = cacheFalsa();
    const w = conCacheDeSitemap(handler, () => cache, () => t);
    const ctx = ctxFalso();
    await w.fetch(new Request(URL_MAPA), {}, ctx);
    await Promise.all(ctx.pendientes);
    t += (VIGENCIA_SEGUNDOS + 1) * 1000;
    await w.fetch(new Request(URL_MAPA), {}, ctx);
    expect(handler.fetch).toHaveBeenCalledTimes(2);
  });

  it("no guarda lo que no es 200 ni lo que trae Set-Cookie, y borra la copia", async () => {
    const cache = cacheFalsa();
    const ctx = ctxFalso();
    const malo = conCacheDeSitemap({ fetch: async () => new Response("x", { status: 500 }) }, () => cache);
    expect((await malo.fetch(new Request(URL_MAPA), {}, ctx)).status).toBe(500);
    const cookie = conCacheDeSitemap(
      { fetch: async () => new Response("x", { headers: { "Set-Cookie": "a=b" } }) },
      () => cache
    );
    await cookie.fetch(new Request(URL_MAPA), {}, ctx);
    await Promise.all(ctx.pendientes);
    expect(cache.put).not.toHaveBeenCalled();
    expect(cache.delete).toHaveBeenCalledTimes(2);
  });

  it("otras rutas, otros métodos y sin caché disponible pasan derecho", async () => {
    const handler = { fetch: vi.fn(async () => new Response("ok")) };
    const cache = cacheFalsa();
    const w = conCacheDeSitemap(handler, () => cache);
    await w.fetch(new Request("https://www.oido.com.ar/"), {}, ctxFalso());
    await w.fetch(new Request(URL_MAPA, { method: "POST" }), {}, ctxFalso());
    await conCacheDeSitemap(handler, () => undefined).fetch(new Request(URL_MAPA), {}, ctxFalso());
    expect(handler.fetch).toHaveBeenCalledTimes(3);
    expect(cache.match).not.toHaveBeenCalled();
  });
});
