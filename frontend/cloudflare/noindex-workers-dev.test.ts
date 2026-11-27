// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { conNoindexEnWorkersDev, esWorkersDev } from "./noindex-workers-dev.mjs";

describe("esWorkersDev", () => {
  it("reconoce los hosts que terminan en workers.dev", () => {
    expect(esWorkersDev("oido-frontend.julietaarrazate.workers.dev")).toBe(true);
    expect(esWorkersDev("OIDO.WORKERS.DEV")).toBe(true);
    expect(esWorkersDev("workers.dev")).toBe(true);
  });

  it("no confunde el dominio propio ni parecidos", () => {
    expect(esWorkersDev("www.oido.com.ar")).toBe(false);
    expect(esWorkersDev("oido.com.ar")).toBe(false);
    expect(esWorkersDev("workers.dev.oido.com.ar")).toBe(false);
    expect(esWorkersDev("notworkers.dev")).toBe(false);
  });
});

describe("conNoindexEnWorkersDev", () => {
  const handler = {
    fetch: vi.fn(async () => new Response("ok", { headers: { "Cache-Control": "no-store" } })),
  };
  const envuelto = conNoindexEnWorkersDev(handler);

  it("agrega X-Robots-Tag: noindex en workers.dev y conserva lo demás", async () => {
    const r = await envuelto.fetch(new Request("https://oido-frontend.cuenta.workers.dev/turno/x"), {}, {});
    expect(r.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(await r.text()).toBe("ok");
  });

  it("no toca las respuestas del dominio propio", async () => {
    const r = await envuelto.fetch(new Request("https://www.oido.com.ar/"), {}, {});
    expect(r.headers.get("X-Robots-Tag")).toBeNull();
  });

  it("anda con una respuesta de cabeceras inmutables", async () => {
    const inmutable = { fetch: async () => Response.redirect("https://www.oido.com.ar/", 308) };
    const r = await conNoindexEnWorkersDev(inmutable).fetch(
      new Request("https://x.cuenta.workers.dev/"),
      {},
      {}
    );
    expect(r.status).toBe(308);
    expect(r.headers.get("X-Robots-Tag")).toBe("noindex");
  });

  it("no toca un upgrade a WebSocket (status 101 o webSocket)", async () => {
    const ws = { status: 101, headers: new Headers(), webSocket: {} };
    const r = await conNoindexEnWorkersDev({ fetch: async () => ws as unknown as Response }).fetch(
      new Request("https://x.cuenta.workers.dev/ws"),
      {},
      {}
    );
    expect(r).toBe(ws);
    expect(ws.headers.get("X-Robots-Tag")).toBeNull();
  });
});
