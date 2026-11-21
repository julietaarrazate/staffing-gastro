import type { StyleSpecification } from "maplibre-gl";
import { describe, expect, it, vi } from "vitest";
import { NOCHE, aplicarTemaAlMapa, cambiosEntreTemas, estiloDeNoche } from "./style";

/** Las 95 capas de CARTO Voyager GL (2026-11-21), `id:tipo`. Si CARTO agrega una, el test de cobertura avisa. */
const CAPAS_DE_CARTO = [
  "background:background",
  "landcover:fill",
  "park_national_park:fill",
  "park_nature_reserve:fill",
  "landuse_residential:fill",
  "landuse:fill",
  "waterway:line",
  "boundary_county:line",
  "boundary_state:line",
  "water:fill",
  "water_shadow:fill",
  "aeroway-runway:line",
  "aeroway-taxiway:line",
  "waterway_label:symbol",
  "tunnel_service_case:line",
  "tunnel_minor_case:line",
  "tunnel_sec_case:line",
  "tunnel_pri_case:line",
  "tunnel_trunk_case:line",
  "tunnel_mot_case:line",
  "tunnel_path:line",
  "tunnel_service_fill:line",
  "tunnel_minor_fill:line",
  "tunnel_sec_fill:line",
  "tunnel_pri_fill:line",
  "tunnel_trunk_fill:line",
  "tunnel_mot_fill:line",
  "tunnel_rail:line",
  "tunnel_rail_dash:line",
  "road_service_case:line",
  "road_minor_case:line",
  "road_pri_case_ramp:line",
  "road_trunk_case_ramp:line",
  "road_mot_case_ramp:line",
  "road_sec_case_noramp:line",
  "road_pri_case_noramp:line",
  "road_trunk_case_noramp:line",
  "road_mot_case_noramp:line",
  "road_path:line",
  "road_path_areas:line",
  "road_service_fill:line",
  "road_minor_fill:line",
  "road_pri_fill_ramp:line",
  "road_trunk_fill_ramp:line",
  "road_mot_fill_ramp:line",
  "road_sec_fill_noramp:line",
  "road_pri_fill_noramp:line",
  "road_trunk_fill_noramp:line",
  "road_mot_fill_noramp:line",
  "rail:line",
  "rail_dash:line",
  "bridge_service_case:line",
  "bridge_minor_case:line",
  "bridge_sec_case:line",
  "bridge_pri_case:line",
  "bridge_trunk_case:line",
  "bridge_mot_case:line",
  "bridge_path:line",
  "bridge_service_fill:line",
  "bridge_minor_fill:line",
  "bridge_sec_fill:line",
  "bridge_pri_fill:line",
  "bridge_trunk_fill:line",
  "bridge_mot_fill:line",
  "building:fill",
  "building-top:fill",
  "boundary_country_outline:line",
  "boundary_country_inner:line",
  "watername_ocean:symbol",
  "watername_sea:symbol",
  "watername_lake:symbol",
  "watername_lake_pois:symbol",
  "watername_lake_line:symbol",
  "place_hamlet:symbol",
  "place_suburbs:symbol",
  "place_villages:symbol",
  "place_town:symbol",
  "place_country_2:symbol",
  "place_country_1:symbol",
  "place_state:symbol",
  "place_continent:symbol",
  "place_city_r6:symbol",
  "place_city_r5:symbol",
  "place_city_dot_r7:symbol",
  "place_city_dot_r4:symbol",
  "place_city_dot_r2:symbol",
  "place_city_dot_z7:symbol",
  "place_capital_dot_z7:symbol",
  "poi_stadium:symbol",
  "poi_park:symbol",
  "roadname_minor:symbol",
  "roadname_sec:symbol",
  "roadname_pri:symbol",
  "roadname_major:symbol",
  "housenumber:symbol",
];

function capasFalsas(): StyleSpecification {
  return {
    version: 8,
    sources: { protomaps: { type: "vector", url: "x" } },
    layers: CAPAS_DE_CARTO.map((c) => {
      const [id, type] = c.split(":");
      const base = {
        id,
        type,
        source: "protomaps",
        "source-layer": "roads",
        filter: ["==", ["get", "k"], id],
        minzoom: 3,
      };
      if (type === "background") return { id, type, paint: { "background-color": "#fbf8f3" } };
      if (type === "symbol")
        return {
          ...base,
          layout: { "text-field": "{name}", "text-size": 9 },
          paint: { "text-color": "#405c78", "text-halo-color": "#f2f5f8", "text-halo-width": 1 },
        };
      if (type === "fill")
        return { ...base, paint: { "fill-color": "#e4dcd0", "fill-antialias": true } };
      return {
        ...base,
        layout: { "line-cap": "round" },
        paint: {
          "line-color": "#ffffff",
          "line-width": {
            stops: [
              [12, 1],
              [16, 6],
            ],
          },
          "line-dasharray": [2, 2],
        },
      };
    }) as StyleSpecification["layers"],
  };
}

function color(s: string): [number, number, number] {
  const n = parseInt(s.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function luz(s: string) {
  const [r, g, b] = color(s).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contraste(a: string, b: string) {
  const [x, y] = [luz(a), luz(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

describe("estiloDeNoche", () => {
  const dia = capasFalsas();
  const noche = estiloDeNoche(dia);
  const paintDe = (e: StyleSpecification, id: string) =>
    (e.layers.find((l) => l.id === id) as { paint: Record<string, unknown> }).paint;

  it("recolorea todas las capas de CARTO (ninguna queda con el color de día)", () => {
    for (const capa of noche.layers) {
      expect(paintDe(noche, capa.id), capa.id).not.toEqual(paintDe(dia, capa.id));
    }
  });

  it("no toca el diseño: ids, orden, tipo, filtros, zooms, layout, fuentes y grosores", () => {
    expect(noche.layers.map((l) => l.id)).toEqual(dia.layers.map((l) => l.id));
    noche.layers.forEach((capa, i) => {
      const { paint: pn, ...restoNoche } = capa as typeof capa & { paint?: unknown };
      const { paint: pd, ...restoDia } = dia.layers[i] as typeof capa & { paint?: unknown };
      expect(restoNoche).toEqual(restoDia);
      const gn = pn as Record<string, unknown>;
      const gd = pd as Record<string, unknown>;
      for (const k of ["line-width", "line-dasharray", "fill-antialias"])
        expect(gn[k]).toEqual(gd[k]);
    });
    expect(noche.sources).toEqual(dia.sources);
  });

  it("no modifica el estilo que recibe", () => {
    const copia = JSON.parse(JSON.stringify(dia));
    estiloDeNoche(dia);
    expect(dia).toEqual(copia);
  });

  it("pinta cada familia con su color", () => {
    expect(paintDe(noche, "background")["background-color"]).toBe(NOCHE.fondo);
    expect(paintDe(noche, "water")["fill-color"]).toBe(NOCHE.agua);
    expect(paintDe(noche, "park_nature_reserve")["fill-color"]).toBe(NOCHE.parque);
    expect(paintDe(noche, "building-top")["fill-color"]).toBe(NOCHE.edificio);
    expect(paintDe(noche, "road_minor_fill")["line-color"]).toBe(NOCHE.calle);
    expect(paintDe(noche, "road_pri_fill_noramp")["line-color"]).toBe(NOCHE.avenida);
    expect(paintDe(noche, "road_mot_fill_noramp")["line-color"]).toBe(NOCHE.autopista);
    expect(paintDe(noche, "place_suburbs")["text-color"]).toBe(NOCHE.rotulo);
  });

  it("la calle chica se ve como calle (y no como borde) hasta el zoom 15,7", () => {
    const c = paintDe(noche, "road_minor_case")["line-color"] as { stops: [number, string][] };
    expect(c.stops[0]).toEqual([13, NOCHE.calle]);
    expect(c.stops[1]).toEqual([15.7, NOCHE.calle]);
  });

  it("conserva la transparencia por zoom de las capas de suelo", () => {
    const base = capasFalsas();
    const capa = base.layers.find((l) => l.id === "landcover") as {
      paint: Record<string, unknown>;
    };
    capa.paint["fill-color"] = {
      stops: [
        [8, "rgba(197, 225, 178, 0.2)"],
        [15, "#e0ecd3"],
      ],
    };
    const n = estiloDeNoche(base);
    const stops = (paintDe(n, "landcover")["fill-color"] as { stops: [number, string][] }).stops;
    expect(stops).toEqual([
      [8, "rgba(29, 74, 72, 0.2)"],
      [15, NOCHE.parque],
    ]);
  });

  it("los rótulos se leen sobre su halo (contraste de 4,5 o más)", () => {
    for (const capa of noche.layers.filter((l) => l.type === "symbol")) {
      const p = paintDe(noche, capa.id);
      const c = contraste(p["text-color"] as string, p["text-halo-color"] as string);
      expect(c, capa.id).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("el agua se distingue del suelo al menos tanto como la calle chica", () => {
    const dif = (a: string, b: string) => Math.abs(luz(a) - luz(b));
    expect(dif(NOCHE.agua, NOCHE.fondo)).toBeGreaterThanOrEqual(dif(NOCHE.calle, NOCHE.fondo));
    expect(dif(NOCHE.aguaBorde, NOCHE.agua)).toBeGreaterThan(0.02);
    expect(paintDe(noche, "water")["fill-outline-color"]).toBe(NOCHE.aguaBorde);
  });

  it("y sobre el fondo de la capa donde van", () => {
    expect(contraste(NOCHE.rotulo, NOCHE.fondo)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(NOCHE.rotulo, NOCHE.calle)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(NOCHE.rotuloParque, NOCHE.parque)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(NOCHE.rotuloAgua, NOCHE.agua)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("aplicarTemaAlMapa", () => {
  const dia = capasFalsas();
  const noche = estiloDeNoche(dia);
  const cambios = cambiosEntreTemas(dia, noche);
  const estilos = { dia, noche, cambios };

  function mapaFalso(inicial: "light" | "dark") {
    const pintura = new Map<string, unknown>();
    const capas = new Set(dia.layers.map((l) => l.id));
    pintura.set("background:background-color", inicial === "dark" ? NOCHE.fondo : "#fbf8f3");
    return {
      pintura,
      getLayer: (id: string) => (capas.has(id) ? {} : undefined),
      getPaintProperty: (id: string, p: string) => pintura.get(`${id}:${p}`),
      setPaintProperty: vi.fn(
        (id: string, p: string, v: unknown) => void pintura.set(`${id}:${p}`, v),
      ),
    };
  }

  it("sólo lista lo que cambia entre día y noche", () => {
    expect(cambios.length).toBeGreaterThan(90);
    expect(cambios.every((c) => JSON.stringify(c.dia) !== JSON.stringify(c.noche))).toBe(true);
  });

  it("repinta las capas al pasar a noche y no hace nada si ya está en ese tema", () => {
    const m = mapaFalso("light");
    aplicarTemaAlMapa(m, "dark", estilos);
    expect(m.setPaintProperty).toHaveBeenCalledTimes(cambios.length);
    expect(m.pintura.get("water:fill-color")).toBe(NOCHE.agua);
    m.setPaintProperty.mockClear();
    aplicarTemaAlMapa(m, "dark", estilos);
    expect(m.setPaintProperty).not.toHaveBeenCalled();
  });

  it("vuelve al de día con los valores originales", () => {
    const m = mapaFalso("dark");
    aplicarTemaAlMapa(m, "light", estilos);
    expect(m.pintura.get("water:fill-color")).toBe("#e4dcd0");
    expect(m.pintura.get("background:background-color")).toBe("#fbf8f3");
  });

  it("ignora capas que el mapa no tiene", () => {
    const m = mapaFalso("light");
    m.getLayer = () => undefined;
    aplicarTemaAlMapa(m, "dark", estilos);
    expect(m.setPaintProperty).not.toHaveBeenCalled();
  });
});
