import { describe, expect, it, vi } from "vitest";
import { turnosParaElMapa } from "./sitemap-turnos";

const ID = "04c36513-c114-43e8-ad9c-8dfcd33d1580";
const json = (cuerpo: unknown, init?: ResponseInit) =>
  vi.fn(async () => new Response(JSON.stringify(cuerpo), init)) as unknown as typeof fetch;

describe("turnosParaElMapa", () => {
  it("arma /turno/<id> con published_at como lastModified", async () => {
    const pedir = json([{ id: ID, published_at: "2026-11-26T15:00:00Z" }]);
    expect(await turnosParaElMapa(pedir)).toEqual([
      { url: `https://www.oido.com.ar/turno/${ID}`, lastModified: "2026-11-26T15:00:00.000Z" },
    ]);
    const [url, opciones] = (pedir as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toMatch(/\/shifts\/public-index$/);
    expect(opciones.next).toEqual({ revalidate: 3600 });
  });

  it("si el backend contesta un error, devuelve vacío", async () => {
    expect(await turnosParaElMapa(json({ detail: "x" }, { status: 503 }))).toEqual([]);
  });

  it("si el backend no responde (red caída o tiempo agotado), devuelve vacío", async () => {
    const caido = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    expect(await turnosParaElMapa(caido)).toEqual([]);
  });

  it("si el cuerpo no es JSON o no es una lista, devuelve vacío", async () => {
    const roto = vi.fn(async () => new Response("<html>")) as unknown as typeof fetch;
    expect(await turnosParaElMapa(roto)).toEqual([]);
    expect(await turnosParaElMapa(json({ id: ID }))).toEqual([]);
  });

  it("descarta entradas inválidas y se queda con las buenas", async () => {
    const pedir = json([
      { id: "no-es-uuid", published_at: "2026-11-26T15:00:00Z" },
      { id: ID, published_at: "no es fecha" },
      { id: ID },
      null,
      { id: ID, published_at: "2026-11-26T15:00:00Z" },
    ]);
    expect(await turnosParaElMapa(pedir)).toHaveLength(1);
  });
});
