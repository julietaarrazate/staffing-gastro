import type { StyleSpecification } from "maplibre-gl";

/**
 * Estilo vectorial del mapa (MapLibre style spec JSON). CARTO Voyager GL:
 * misma familia visual que el raster que usábamos antes, pero vectorial,
 * gratuito y sin API key. Ver docs/reference/MAPS_REDESIGN.md §4.1 y ADR-0001.
 */
export const MAP_STYLE_URL = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

/**
 * La paleta de noche del mapa (2026-11-21): azul noche, como el Google Maps de
 * noche. Antes, de noche se invertía el mapa de día con un filtro CSS y salía
 * marrón; ahora se pinta capa por capa. Los mismos valores, como variables
 * `--mapa-*`, los usa el mapa chico (`globals.css`): si cambia uno, cambia el otro.
 */
export const NOCHE = {
  fondo: "#16233a",
  residencial: "#1a2a44",
  parque: "#1d4a48",
  agua: "#0e2238",
  aguaLinea: "#1a3a5c",
  edificio: "#1e2d48",
  edificioBajo: "#1a2840",
  edificioBorde: "#2a3d5f",
  calle: "#2a3a59",
  calleBorde: "#1d2c47",
  avenida: "#3d527d",
  avenidaBorde: "#2c3e63",
  autopista: "#4b6290",
  autopistaBorde: "#38507f",
  sendero: "#34466a",
  riel: "#31456b",
  pista: "#243453",
  limite: "#2e4066",
  limitePais: "#44598a",
  rotulo: "#a9bddb",
  rotuloLejano: "#94a9ca",
  rotuloAvenida: "#c4d3ea",
  rotuloAutopista: "#dbe6f6",
  rotuloAgua: "#7fa6d6",
  rotuloParque: "#9fe0d2",
  rotuloParqueHalo: "#17393a",
  numero: "#7d92b4",
} as const;

type Paint = Record<string, unknown>;
type Cambio = string | number | (() => unknown);
type Cambios = Record<string, Cambio>;

/** `#rrggbb` o `rgba(r, g, b, a)` a [r, g, b, alfa]; `null` si no es ninguno. */
function leerColor(c: string): [number, number, number, number] | null {
  const hex = /^#([0-9a-f]{6})$/i.exec(c.trim());
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(c.trim());
  if (rgba)
    return [
      Number(rgba[1]),
      Number(rgba[2]),
      Number(rgba[3]),
      rgba[4] === undefined ? 1 : Number(rgba[4]),
    ];
  return null;
}

/** El color nuevo con la transparencia del original (las capas de suelo la usan por zoom). */
function conAlfa(nuevo: string, original: string): string {
  const a = leerColor(original)?.[3] ?? 1;
  const n = leerColor(nuevo);
  if (a === 1 || !n) return nuevo;
  return `rgba(${n[0]}, ${n[1]}, ${n[2]}, ${a})`;
}

/**
 * Cambia el color de una propiedad conservando su forma: un texto se
 * reemplaza; una función por zoom (`{stops:[[zoom, color],…]}`) mantiene sus
 * zooms y la transparencia de cada tramo.
 */
function teñir(original: unknown, nuevo: string): unknown {
  if (typeof original === "string") return conAlfa(nuevo, original);
  if (original && typeof original === "object" && !Array.isArray(original)) {
    const f = original as { stops?: [number, unknown][] };
    if (Array.isArray(f.stops)) {
      return {
        ...f,
        stops: f.stops.map(([z, c]) => [z, typeof c === "string" ? conAlfa(nuevo, c) : nuevo]),
      };
    }
  }
  return nuevo;
}

/** Mezcla `a` hacia `b` (0 = a, 1 = b): los túneles van más apagados que la calle de arriba. */
function mezclar(a: string, b: string, t: number): string {
  const x = leerColor(a)!;
  const y = leerColor(b)!;
  const c = (i: number) => Math.round(x[i] + (y[i] - x[i]) * t);
  return `#${[c(0), c(1), c(2)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

type Clase = "calle" | "avenida" | "autopista";

function claseDeCalle(id: string): Clase {
  if (/_(trunk|mot)_/.test(id)) return "autopista";
  if (/_(sec|pri)_/.test(id)) return "avenida";
  return "calle";
}

const RELLENO: Record<Clase, string> = {
  calle: NOCHE.calle,
  avenida: NOCHE.avenida,
  autopista: NOCHE.autopista,
};
const BORDE: Record<Clase, string> = {
  calle: NOCHE.calleBorde,
  avenida: NOCHE.avenidaBorde,
  autopista: NOCHE.autopistaBorde,
};

function rotulo(texto: string, halo: string, ancho = 1.5): Cambios {
  return {
    "text-color": texto,
    "text-halo-color": halo,
    "text-halo-width": ancho,
  };
}

/**
 * Qué propiedades de pintura cambian en cada capa, por familia. Una capa que
 * ninguna regla reconoce queda como vino (el test de cobertura avisa si CARTO
 * agrega una).
 */
function cambiosDeNoche(id: string): Cambios | null {
  if (id === "background") return { "background-color": NOCHE.fondo };
  if (id === "landuse_residential") return { "fill-color": NOCHE.residencial };
  if (id === "landcover" || id === "landuse" || id.startsWith("park_"))
    return { "fill-color": NOCHE.parque };
  if (id === "waterway") return { "line-color": NOCHE.aguaLinea };
  if (id === "water" || id === "water_shadow") return { "fill-color": NOCHE.agua };
  if (id.startsWith("aeroway")) return { "line-color": NOCHE.pista };
  if (id === "boundary_county" || id === "boundary_state") return { "line-color": NOCHE.limite };
  if (id === "boundary_country_inner") return { "line-color": NOCHE.limitePais };
  if (id === "boundary_country_outline") return { "line-color": NOCHE.fondo };
  if (id === "building") return { "fill-color": NOCHE.edificioBajo };
  if (id === "building-top")
    return {
      "fill-color": NOCHE.edificio,
      "fill-outline-color": NOCHE.edificioBorde,
    };

  // Vías
  if (id === "rail" || id === "tunnel_rail") return { "line-color": NOCHE.riel };
  if (id === "rail_dash" || id === "tunnel_rail_dash") return { "line-color": NOCHE.fondo };
  if (/(^|_)path(_areas)?$/.test(id)) return { "line-color": NOCHE.sendero };
  const via = /^(tunnel|road|bridge)_.*_(case|fill)/.exec(id);
  if (via) {
    const clase = claseDeCalle(id);
    const esBorde = via[2] === "case";
    const apagar = (c: string) => (via[1] === "tunnel" ? mezclar(c, NOCHE.fondo, 0.45) : c);
    const color = apagar(esBorde ? BORDE[clase] : RELLENO[clase]);
    // Hasta el zoom 15,7 la calle chica se dibuja sólo con su «borde» (el
    // relleno entra después): ahí el borde ES la calle y tiene que verse.
    if (esBorde && clase === "calle" && id.includes("minor")) {
      const calle = apagar(NOCHE.calle);
      return {
        "line-color": () => ({
          stops: [
            [13, calle],
            [15.7, calle],
            [16, color],
          ],
        }),
      };
    }
    return { "line-color": color };
  }

  // Rótulos
  if (id === "place_state" || id.startsWith("place_country"))
    return rotulo(NOCHE.rotuloLejano, NOCHE.fondo);
  if (id.startsWith("place_"))
    return { ...rotulo(NOCHE.rotulo, NOCHE.fondo), "icon-color": NOCHE.rotulo };
  if (id === "waterway_label" || id.startsWith("watername_"))
    return rotulo(NOCHE.rotuloAgua, NOCHE.agua);
  if (id.startsWith("poi_")) return rotulo(NOCHE.rotuloParque, NOCHE.rotuloParqueHalo);
  if (id === "roadname_minor") return rotulo(NOCHE.rotulo, NOCHE.calle, 1.25);
  if (id === "roadname_sec") return rotulo(NOCHE.rotuloAvenida, NOCHE.avenida, 1.25);
  if (id === "roadname_pri") return rotulo(NOCHE.rotuloAutopista, NOCHE.avenida, 1.25);
  if (id === "roadname_major") return rotulo(NOCHE.rotuloAutopista, NOCHE.autopista, 1.25);
  if (id === "housenumber") return rotulo(NOCHE.numero, NOCHE.fondo, 0.75);
  return null;
}

/**
 * La versión de noche de un estilo: las mismas capas, en el mismo orden y con
 * el mismo diseño (`layout`, `filter`, zooms, fuentes), con sólo la pintura
 * (`paint`) recoloreada por familia de capa. No modifica el estilo que recibe.
 */
export function estiloDeNoche(estilo: StyleSpecification): StyleSpecification {
  return {
    ...estilo,
    layers: estilo.layers.map((capa) => {
      const cambios = cambiosDeNoche(capa.id);
      if (!cambios) return capa;
      const paint: Paint = { ...(("paint" in capa && capa.paint) || {}) };
      for (const [prop, cambio] of Object.entries(cambios)) {
        if (typeof cambio === "function") paint[prop] = cambio();
        else if (typeof cambio === "number") paint[prop] = cambio;
        else paint[prop] = teñir(paint[prop], cambio);
      }
      return { ...capa, paint } as typeof capa;
    }),
  };
}

/** Qué cambia entre el día y la noche, por capa y propiedad: lo único que hay que tocar al cambiar de tema. */
export type CambioDeTema = {
  id: string;
  prop: string;
  dia: unknown;
  noche: unknown;
};

export function cambiosEntreTemas(
  dia: StyleSpecification,
  noche: StyleSpecification,
): CambioDeTema[] {
  const diaPorId = new Map(dia.layers.map((c) => [c.id, c]));
  const lista: CambioDeTema[] = [];
  for (const capa of noche.layers) {
    const d = diaPorId.get(capa.id);
    const pn = ("paint" in capa ? capa.paint : undefined) as Paint | undefined;
    const pd = (d && "paint" in d ? d.paint : undefined) as Paint | undefined;
    if (!pn) continue;
    for (const prop of Object.keys(pn)) {
      if (JSON.stringify(pn[prop]) !== JSON.stringify(pd?.[prop])) {
        lista.push({ id: capa.id, prop, dia: pd?.[prop], noche: pn[prop] });
      }
    }
  }
  return lista;
}

export type EstilosDelMapa = {
  dia: StyleSpecification;
  noche: StyleSpecification;
  cambios: CambioDeTema[];
};

let estilosPromesa: Promise<EstilosDelMapa> | null = null;
let estilosListos: EstilosDelMapa | null = null;

/** Baja el estilo de CARTO una sola vez (lo comparten todos los mapas) y arma su versión de noche. */
export function cargarEstilos(): Promise<EstilosDelMapa> {
  if (!estilosPromesa) {
    estilosPromesa = fetch(MAP_STYLE_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`estilo ${r.status}`);
        return r.json() as Promise<StyleSpecification>;
      })
      .then((dia) => {
        const noche = estiloDeNoche(dia);
        estilosListos = { dia, noche, cambios: cambiosEntreTemas(dia, noche) };
        return estilosListos;
      })
      .catch((e) => {
        estilosPromesa = null; // que el próximo intento vuelva a pedirlo
        throw e;
      });
  }
  return estilosPromesa;
}

/** El estilo ya bajado, si lo hay (para aplicarlo sin esperar). */
export function estilosCargados(): EstilosDelMapa | null {
  return estilosListos;
}

type MapaPintable = {
  getLayer(id: string): unknown;
  getPaintProperty(id: string, prop: string): unknown;
  setPaintProperty(id: string, prop: string, value: unknown): void;
};

/**
 * Pone el mapa en el tema pedido SIN recargar el estilo: sólo cambia la
 * pintura de las capas que difieren. Así no se pierde la cámara ni las capas
 * que las pantallas le agregan encima (el radio de búsqueda, la ruta). Si ya
 * está en ese tema no hace nada.
 */
export function aplicarTemaAlMapa(mapa: MapaPintable, tema: "light" | "dark", e: EstilosDelMapa) {
  const fondo = e.cambios.find((c) => c.id === "background" && c.prop === "background-color");
  if (fondo && mapa.getLayer("background")) {
    const actual = mapa.getPaintProperty("background", "background-color");
    if (JSON.stringify(actual) === JSON.stringify(tema === "dark" ? fondo.noche : fondo.dia))
      return;
  }
  for (const c of e.cambios) {
    if (!mapa.getLayer(c.id)) continue;
    mapa.setPaintProperty(c.id, c.prop, tema === "dark" ? c.noche : c.dia);
  }
}
