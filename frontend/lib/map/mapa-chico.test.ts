import { PbfWriter } from "pbf";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ESCALA, LADO, aPixel, elegirRotulos, leerTrazos, mosaicosVisibles, type Mosaico, type Trazos } from "./mapa-chico";

/**
 * Arma un mosaico vectorial (spec MVT 2.1) chico, con capas y features a
 * mano: así se prueba la lectura sin guardar un binario en el repo.
 */
type Feature = { tipo: 1 | 2 | 3; props: Record<string, string>; anillos: [number, number][][] };
function mosaico(capas: Record<string, Feature[]>): Uint8Array {
  const zigzag = (n: number) => (n << 1) ^ (n >> 31);
  const comando = (id: number, n: number) => (id & 0x7) | (n << 3);
  const pbf = new PbfWriter();
  for (const [nombre, features] of Object.entries(capas)) {
    const keys: string[] = [];
    const values: string[] = [];
    const idx = (lista: string[], v: string) => (lista.includes(v) ? lista.indexOf(v) : lista.push(v) - 1);
    const codificadas = features.map((f) => {
      const tags = Object.entries(f.props).flatMap(([k, v]) => [idx(keys, k), idx(values, v)]);
      const geom: number[] = [];
      let cx = 0;
      let cy = 0;
      for (const anillo of f.anillos) {
        anillo.forEach(([x, y], i) => {
          if (i === 0) geom.push(comando(1, 1));
          if (i === 1) geom.push(comando(2, anillo.length - 1));
          geom.push(zigzag(x - cx), zigzag(y - cy));
          cx = x;
          cy = y;
        });
        if (f.tipo === 3) geom.push(comando(7, 1));
      }
      return { tags, tipo: f.tipo, geom };
    });
    pbf.writeMessage(3, (_: unknown, w: PbfWriter) => {
      w.writeVarintField(15, 2);
      w.writeStringField(1, nombre);
      for (const f of codificadas) {
        w.writeMessage(2, (_f: unknown, wf: PbfWriter) => {
          wf.writePackedVarint(2, f.tags);
          wf.writeVarintField(3, f.tipo);
          wf.writePackedVarint(4, f.geom);
        }, null);
      }
      for (const k of keys) w.writeStringField(3, k);
      for (const v of values) w.writeMessage(4, (_v: unknown, wv: PbfWriter) => wv.writeStringField(1, v), null);
      w.writeVarintField(5, 4096);
    }, null);
  }
  return pbf.finish();
}

const PALERMO = { lat: -34.5889, lng: -58.4306 };

describe("cuentas del mapa chico", () => {
  it("Palermo cae en el mosaico 5532/9871 del zoom 14, como en el mapa grande", () => {
    const p = aPixel(PALERMO.lat, PALERMO.lng);
    expect(Math.floor(p.x / LADO)).toBe(5532);
    expect(Math.floor(p.y / LADO)).toBe(9871);
  });

  it("los mosaicos visibles tapan el recuadro y el centro cae en el medio", () => {
    const centro = aPixel(PALERMO.lat, PALERMO.lng);
    const lista = mosaicosVisibles(centro, 326, 112);
    expect(lista.length).toBeGreaterThanOrEqual(1);
    expect(lista.length).toBeLessThanOrEqual(4);
    // Cada punto del recuadro está en algún mosaico.
    for (const [x, y] of [[0, 0], [325, 0], [0, 111], [325, 111], [163, 56]]) {
      expect(lista.some((m) => x >= m.left && x < m.left + LADO && y >= m.top && y < m.top + LADO)).toBe(true);
    }
    // El centro del mundo queda en el centro del recuadro.
    const m = lista.find((t) => t.x === Math.floor(centro.x / LADO) && t.y === Math.floor(centro.y / LADO))!;
    expect(m.left + (centro.x - m.x * LADO)).toBeCloseTo(163);
    expect(m.top + (centro.y - m.y * LADO)).toBeCloseTo(56);
  });

  it("una latitud de polo (±90) no cuelga la pestaña: se acota al borde del mapa", () => {
    for (const lat of [90, -90, 1e9]) {
      const p = aPixel(lat, 0);
      expect(Number.isFinite(p.y)).toBe(true);
      expect(mosaicosVisibles(p, 326, 112).length).toBeLessThanOrEqual(4);
    }
    expect(mosaicosVisibles({ x: 0, y: Infinity }, 326, 112)).toEqual([]);
  });

  it("sin tamaño todavía, no pide mosaicos", () => {
    expect(mosaicosVisibles({ x: 0, y: 0 }, 0, 112)).toEqual([]);
  });
});

describe("leerTrazos", () => {
  it("toma calles, avenidas con nombre, plazas, agua y barrios; ignora el resto", () => {
    const buf = mosaico({
      roads: [
        { tipo: 2, props: { kind: "major_road", name: "Avenida Córdoba" }, anillos: [[[0, 0], [100, 100]]] },
        { tipo: 2, props: { kind: "minor_road", name: "Honduras" }, anillos: [[[10, 0], [10, 50]]] },
        { tipo: 2, props: { kind: "path" }, anillos: [[[5, 5], [6, 6]]] },
      ],
      landuse: [
        { tipo: 3, props: { kind: "park" }, anillos: [[[0, 0], [10, 0], [10, 10]]] },
        { tipo: 3, props: { kind: "residential" }, anillos: [[[0, 0], [20, 0], [20, 20]]] },
      ],
      water: [{ tipo: 3, props: { kind: "water" }, anillos: [[[30, 30], [40, 30], [40, 40]]] }],
      places: [{ tipo: 1, props: { kind: "neighbourhood", name: "Palermo Soho" }, anillos: [[[200, 300]]] }],
    });
    const t = leerTrazos(buf);
    expect(t.avenidas).toBe("M0 0L100 100");
    expect(t.calles).toBe("M10 0L10 50");
    // vector-tile cierra el anillo repitiendo el primer punto.
    expect(t.parques).toBe("M0 0L10 0L10 10L0 0Z");
    expect(t.agua).toBe("M30 30L40 30L40 40L30 30Z");
    expect(t.avenidasConNombre).toEqual([{ nombre: "Avenida Córdoba", linea: [{ x: 0, y: 0 }, { x: 100, y: 100 }] }]);
    expect(t.barrios).toEqual([{ nombre: "Palermo Soho", punto: { x: 200, y: 300 } }]);
  });
});

describe("elegirRotulos", () => {
  const vacio: Trazos = { parques: "", agua: "", avenidas: "", calles: "", avenidasConNombre: [], barrios: [] };
  const unMosaico: Mosaico = { x: 0, y: 0, left: 0, top: 0 };
  // En unidades del mosaico: dividir por ESCALA lleva a píxeles del recuadro.
  const u = (px: number) => px / ESCALA;

  it("rotula el barrio y la avenida más larga a la vista, lejos del local", () => {
    const t: Trazos = {
      ...vacio,
      barrios: [{ nombre: "Palermo Soho", punto: { x: u(250), y: u(8) } }],
      avenidasConNombre: [
        { nombre: "Avenida Corta", linea: [{ x: u(10), y: u(100) }, { x: u(40), y: u(100) }] },
        { nombre: "Avenida Córdoba", linea: [{ x: u(10), y: u(20) }, { x: u(110), y: u(90) }] },
      ],
    };
    const r = elegirRotulos([unMosaico], () => t, 326, 112);
    expect(r.barrio).toMatchObject({ nombre: "Palermo Soho", x: 250 });
    expect(r.barrio!.y).toBe(14); // pegado arriba, se baja para que se lea entero
    expect(r.avenida).toMatchObject({ nombre: "Av. Córdoba" });
  });

  it("no tapa el local ni pone texto patas arriba", () => {
    const t: Trazos = {
      ...vacio,
      // Un barrio justo sobre el local (centro 163, 56): no va.
      barrios: [{ nombre: "Encima", punto: { x: u(165), y: u(58) } }],
      // Dibujada de derecha a izquierda: el texto igual va derecho.
      avenidasConNombre: [{ nombre: "Avenida Al Revés", linea: [{ x: u(300), y: u(100) }, { x: u(200), y: u(100) }] }],
    };
    const r = elegirRotulos([unMosaico], () => t, 326, 112);
    expect(r.barrio).toBeNull();
    expect(Math.abs(r.avenida!.angulo)).toBeLessThanOrEqual(90);
  });

  it("sin datos todavía, no rotula nada", () => {
    expect(elegirRotulos([unMosaico], () => undefined, 326, 112)).toEqual({ barrio: null, avenida: null });
  });
});

describe("pedirTrazos", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const ok = (cuerpo: Uint8Array | object) =>
    cuerpo instanceof Uint8Array
      ? { ok: true, arrayBuffer: async () => cuerpo.buffer.slice(cuerpo.byteOffset, cuerpo.byteOffset + cuerpo.byteLength) }
      : { ok: true, json: async () => cuerpo };
  const buf = mosaico({ roads: [{ tipo: 2, props: { kind: "minor_road" }, anillos: [[[0, 0], [5, 5]]] }] });

  it("si CARTO cambia la versión de los mosaicos, lee la vigente del estilo y reintenta una vez", async () => {
    const { pedirTrazos } = await import("./mapa-chico");
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("style.json")) return ok({ sources: { calles: { type: "vector", tiles: ["https://nuevo.test/{z}/{x}/{y}.mvt"] } } });
      if (url.startsWith("https://nuevo.test/14/1/2.mvt")) return ok(buf);
      return { ok: false, status: 404 };
    });
    const t = await pedirTrazos(1, 2);
    expect(t?.calles).toBe("M0 0L5 5");
    expect(fetchMock.mock.calls.map(([u]) => String(u).split("/")[2])).toEqual([
      "tiles.basemaps.cartocdn.com",
      "basemaps.cartocdn.com",
      "nuevo.test",
    ]);
  });

  it("si no hay forma de bajarlo, devuelve null (el mapa queda con el fondo y el local) y el próximo intento vuelve a pedir", async () => {
    const { pedirTrazos } = await import("./mapa-chico");
    fetchMock.mockRejectedValue(new Error("sin conexión"));
    expect(await pedirTrazos(3, 4)).toBeNull();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(ok(buf));
    expect((await pedirTrazos(3, 4))?.calles).toBe("M0 0L5 5");
  });

  it("si leer el estilo falla una vez (sin red), se vuelve a leer en el próximo intento", async () => {
    const { pedirTrazos } = await import("./mapa-chico");
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("style.json")) throw new Error("sin conexión");
      return { ok: false, status: 404 };
    });
    expect(await pedirTrazos(7, 8)).toBeNull();
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("style.json")) return ok({ sources: { s: { type: "vector", tiles: ["https://otra.test/{z}/{x}/{y}.mvt"] } } });
      if (url.startsWith("https://otra.test/")) return ok(buf);
      return { ok: false, status: 404 };
    });
    expect((await pedirTrazos(7, 8))?.calles).toBe("M0 0L5 5");
  });

  it("dos tarjetas en el mismo barrio comparten el pedido", async () => {
    const { pedirTrazos } = await import("./mapa-chico");
    fetchMock.mockResolvedValue(ok(buf));
    await Promise.all([pedirTrazos(5, 6), pedirTrazos(5, 6)]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
