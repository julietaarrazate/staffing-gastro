import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OrejaIcon, SearchIcon } from "@/components/icons";

describe("OrejaIcon (el ícono del asistente)", () => {
  it("es de trazo, con el mismo grosor y color heredado que el resto de los íconos", () => {
    const { container: oreja } = render(<OrejaIcon />);
    const { container: lupa } = render(<SearchIcon />);
    const a = oreja.querySelector("svg")!;
    const b = lupa.querySelector("svg")!;
    expect(a.getAttribute("stroke")).toBe("currentColor");
    expect(a.getAttribute("fill")).toBe("none");
    expect(a.getAttribute("stroke-width")).toBe(b.getAttribute("stroke-width"));
    expect(a.getAttribute("stroke-linecap")).toBe(b.getAttribute("stroke-linecap"));
    expect(a.getAttribute("stroke-linejoin")).toBe(b.getAttribute("stroke-linejoin"));
    expect(a.getAttribute("viewBox")).toBe("0 0 24 24");
  });

  it("toma el tamaño por prop, es decorativo por defecto y dibuja borde y pliegue", () => {
    const { container } = render(<OrejaIcon size={64} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("64");
    expect(svg.getAttribute("height")).toBe("64");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.querySelectorAll("path")).toHaveLength(2);
  });
});
