import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";
import { MAP_STYLE_URL } from "@/lib/map/style";

/**
 * El mapa chico de un turno o un local (`components/MiniMap.tsx`) es un
 * DIBUJO del barrio, no un mapa de MapLibre: lee los mismos mosaicos
 * vectoriales de CARTO que el mapa grande y dibuja calles, avenidas, plazas y
 * agua en SVG. Acá vive lo que no depende de React (cuentas, lectura de los
 * mosaicos, rótulos), para poder probarlo.
 *
 * Por qué así (2026-11-19, docs/reference/RENDIMIENTO.md): con MapLibre cada
 * tarjeta bajaba el motor entero (~1 MB de JS) y abría su propio WebGL para
 * una foto de 112 px que no se puede tocar; Mis turnos pesaba el doble que
 * las demás pantallas. Los mosaicos-imagen de CARTO ahora piden clave; los
 * vectoriales, no.
 */

/** Zoom 14 con mosaicos de 512 px: la misma escala que tenía con MapLibre. */
export const ZOOM = 14;
export const LADO = 512;
/** Unidades internas de un mosaico vectorial. */
const EXTENSION = 4096;
export const ESCALA = LADO / EXTENSION;

/**
 * La dirección de los mosaicos que trae hoy el estilo de CARTO. Lleva una
 * versión en el camino: si CARTO la cambia y ésta deja de responder, se lee
 * la vigente del estilo (`plantillaDelEstilo`) y se reintenta una vez.
 */
export const MOSAICOS_DE_RESPALDO =
  "https://tiles.basemaps.cartocdn.com/v/20261026-01/vectortiles/carto.streets/v2/{z}/{x}/{y}.mvt";

export type Punto = { x: number; y: number };

export type Trazos = {
  parques: string;
  agua: string;
  avenidas: string;
  calles: string;
  /** Tramos de avenidas con nombre, en unidades del mosaico. */
  avenidasConNombre: { nombre: string; linea: Punto[] }[];
  barrios: { nombre: string; punto: Punto }[];
};

export type Mosaico = { x: number; y: number; left: number; top: number };

const PARQUES = new Set(["park", "grass", "garden", "playground", "dog_park", "pitch", "forest", "recreation_ground"]);

/** Latitud y longitud a píxeles del mundo, a `ZOOM` (Web Mercator). */
export function aPixel(latitude: number, longitude: number): Punto {
  const mundo = LADO * 2 ** ZOOM;
  const seno = Math.sin((latitude * Math.PI) / 180);
  return {
    x: ((longitude + 180) / 360) * mundo,
    y: (0.5 - Math.log((1 + seno) / (1 - seno)) / (4 * Math.PI)) * mundo,
  };
}

/** Los mosaicos que tapan un recuadro de `w`×`h` centrado en `centro`, con su lugar en el recuadro. */
export function mosaicosVisibles(centro: Punto, w: number, h: number): Mosaico[] {
  if (w <= 0 || h <= 0) return [];
  const lista: Mosaico[] = [];
  const x0 = Math.floor((centro.x - w / 2) / LADO);
  const x1 = Math.floor((centro.x + w / 2) / LADO);
  const y0 = Math.floor((centro.y - h / 2) / LADO);
  const y1 = Math.floor((centro.y + h / 2) / LADO);
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      lista.push({ x, y, left: x * LADO - centro.x + w / 2, top: y * LADO - centro.y + h / 2 });
    }
  }
  return lista;
}

function trazo(anillos: Punto[][], cerrar: boolean) {
  return anillos
    .map((a) => a.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join("") + (cerrar ? "Z" : ""))
    .join("");
}

/** Lee un mosaico vectorial y arma los trazos del dibujo. */
export function leerTrazos(buf: ArrayBuffer | Uint8Array): Trazos {
  const vt = new VectorTile(new PbfReader(buf instanceof Uint8Array ? buf : new Uint8Array(buf)));
  const out: Trazos = { parques: "", agua: "", avenidas: "", calles: "", avenidasConNombre: [], barrios: [] };
  const capa = (nombre: string, cada: (props: Record<string, unknown>, geom: Punto[][], tipo: number) => void) => {
    const l = vt.layers[nombre];
    if (!l) return;
    for (let i = 0; i < l.length; i++) {
      const f = l.feature(i);
      cada(f.properties as Record<string, unknown>, f.loadGeometry(), f.type);
    }
  };
  capa("landuse", (p, g, t) => {
    if (t === 3 && PARQUES.has(String(p.kind))) out.parques += trazo(g, true);
  });
  capa("water", (_p, g, t) => {
    if (t === 3) out.agua += trazo(g, true);
  });
  capa("roads", (p, g, t) => {
    if (t !== 2) return;
    if (p.kind === "major_road" || p.kind === "highway") {
      out.avenidas += trazo(g, false);
      if (typeof p.name === "string") for (const linea of g) out.avenidasConNombre.push({ nombre: p.name, linea });
    } else if (p.kind === "minor_road") {
      out.calles += trazo(g, false);
    }
  });
  capa("places", (p, g, t) => {
    if (t === 1 && p.kind === "neighbourhood" && typeof p.name === "string") out.barrios.push({ nombre: p.name, punto: g[0][0] });
  });
  return out;
}

export type Rotulos = {
  barrio: { nombre: string; x: number; y: number } | null;
  avenida: { nombre: string; x: number; y: number; angulo: number } | null;
};

/**
 * Qué se rotula, como en el mapa de antes: el barrio que cae adentro y la
 * avenida con el tramo más largo a la vista, lejos del local (que no se
 * tapen) y derechos (nunca patas arriba).
 */
export function elegirRotulos(
  mosaicos: Mosaico[],
  trazosDe: (m: Mosaico) => Trazos | undefined,
  w: number,
  h: number,
): Rotulos {
  let barrio: Rotulos["barrio"] = null;
  let avenida: (NonNullable<Rotulos["avenida"]> & { largo: number }) | null = null;
  const lejosDelLocal = (q: Punto) => Math.hypot(q.x - w / 2, q.y - h / 2) > 36;
  const adentro = (q: Punto, margen: number) => q.x > margen && q.x < w - margen && q.y > 2 && q.y < h - 2;
  for (const m of mosaicos) {
    const t = trazosDe(m);
    if (!t) continue;
    const aVista = (q: Punto) => ({ x: m.left + q.x * ESCALA, y: m.top + q.y * ESCALA });
    for (const b of t.barrios) {
      const q = aVista(b.punto);
      if (!barrio && adentro(q, 40) && lejosDelLocal(q)) {
        barrio = { nombre: b.nombre, x: q.x, y: Math.min(Math.max(q.y, 14), h - 20) };
      }
    }
    for (const a of t.avenidasConNombre) {
      const tramos: Punto[][] = [];
      let tramo: Punto[] = [];
      for (const q of a.linea.map(aVista)) {
        if (adentro(q, 4)) {
          tramo.push(q);
        } else if (tramo.length) {
          tramos.push(tramo);
          tramo = [];
        }
      }
      if (tramo.length) tramos.push(tramo);
      for (const tr of tramos) {
        const ini = tr[0];
        const fin = tr[tr.length - 1];
        const largo = Math.hypot(fin.x - ini.x, fin.y - ini.y);
        const medio = { x: (ini.x + fin.x) / 2, y: (ini.y + fin.y) / 2 };
        if (largo > 40 && lejosDelLocal(medio) && (!avenida || largo > avenida.largo)) {
          let angulo = (Math.atan2(fin.y - ini.y, fin.x - ini.x) * 180) / Math.PI;
          if (angulo > 90) angulo -= 180;
          if (angulo < -90) angulo += 180;
          avenida = { nombre: a.nombre.replace(/^Avenida /, "Av. "), ...medio, angulo, largo };
        }
      }
    }
  }
  return { barrio, avenida: avenida && { nombre: avenida.nombre, x: avenida.x, y: avenida.y, angulo: avenida.angulo } };
}

// ---------------------------------------------------------------- red

let plantilla = MOSAICOS_DE_RESPALDO;
let plantillaRenovada: Promise<string> | null = null;

/** La dirección de los mosaicos que trae el estilo de CARTO hoy (una vez por sesión). */
function plantillaDelEstilo(): Promise<string> {
  plantillaRenovada ??= fetch(MAP_STYLE_URL)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((estilo: { sources?: Record<string, { type?: string; tiles?: string[] }> }) => {
      const fuente = Object.values(estilo.sources ?? {}).find((s) => s.type === "vector" && s.tiles?.length);
      return fuente?.tiles?.[0] ?? plantilla;
    })
    .catch(() => plantilla);
  return plantillaRenovada;
}

const url = (base: string, x: number, y: number) =>
  base.replace("{z}", String(ZOOM)).replace("{x}", String(x)).replace("{y}", String(y));

const cache = new Map<string, Promise<Trazos | null>>();

/**
 * Los trazos de un mosaico, pedidos una sola vez por sesión (varias tarjetas
 * en el mismo barrio comparten). Si la dirección de respaldo deja de andar,
 * se renueva desde el estilo y se reintenta. Si nada anda, `null`: el mapa
 * queda con el fondo y el local, sin romperse.
 */
export function pedirTrazos(x: number, y: number): Promise<Trazos | null> {
  const clave = `${x}/${y}`;
  let pedido = cache.get(clave);
  if (!pedido) {
    const bajar = async (base: string) => {
      const r = await fetch(url(base, x, y));
      if (!r.ok) throw new Error(String(r.status));
      return leerTrazos(await r.arrayBuffer());
    };
    pedido = bajar(plantilla)
      .catch(async () => {
        const nueva = await plantillaDelEstilo();
        if (nueva === plantilla) throw new Error("sin mosaicos");
        plantilla = nueva;
        return bajar(nueva);
      })
      .catch(() => {
        cache.delete(clave);
        return null;
      });
    cache.set(clave, pedido);
  }
  return pedido;
}
