import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * Regresión del bug que casi cuesta el upgrade de maplibre-gl 5 → 6 (CVE
 * GHSA-jrc7-96c5-q579, XSS): montar un `Source`/`Layer` ANTES de que el mapa
 * dispare `load` deja a maplibre 6 con `isStyleLoaded()` en `false` de forma
 * permanente. El `load` no llega nunca (medido: tampoco a los 60s), así que
 * `ShiftMap` no calcula su viewport inicial y `/map` queda sin un solo
 * marcador de turno — sin ningún error en consola. maplibre 5 lo toleraba.
 *
 * El invariante que lo evita vive en `MapView`: los hijos se montan recién
 * después del `load`. Este test lo fija donde se rompería en silencio, porque
 * el síntoma (un mapa vacío) no se parece en nada a la causa.
 */

// El mapa real necesita WebGL, que jsdom no tiene: se reemplaza por un doble
// que sólo hace lo que importa acá — renderizar hijos y exponer el `onLoad`.
let fireLoad: (() => void) | null = null;

vi.mock("@vis.gl/react-maplibre", () => ({
  Map: ({ children, onLoad }: { children?: React.ReactNode; onLoad?: (e: unknown) => void }) => {
    fireLoad = () => onLoad?.({ target: { jumpTo: vi.fn() } });
    return <div data-testid="map">{children}</div>;
  },
  AttributionControl: () => null,
}));

vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));

const { default: MapView } = await import("./MapView");

describe("MapView: los hijos se montan después del load", () => {
  it("no monta capas ni marcadores antes de que el mapa cargue", () => {
    fireLoad = null;
    render(
      <MapView center={[-34.6, -58.38]}>
        <div data-testid="capa" />
      </MapView>
    );

    // El mapa está montado, pero sus hijos todavía no: si esto falla, un
    // `Source` volvería a colarse durante la carga del estilo.
    expect(screen.getByTestId("map")).toBeInTheDocument();
    expect(screen.queryByTestId("capa")).not.toBeInTheDocument();
  });

  it("los monta en cuanto el mapa dispara load", async () => {
    fireLoad = null;
    const { findByTestId } = render(
      <MapView center={[-34.6, -58.38]}>
        <div data-testid="capa" />
      </MapView>
    );

    expect(fireLoad).toBeTypeOf("function");
    fireLoad!();

    expect(await findByTestId("capa")).toBeInTheDocument();
  });
});
