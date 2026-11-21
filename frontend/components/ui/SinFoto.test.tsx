import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SinFoto from "./SinFoto";
import { variantePorId } from "./PortadaCielo";

describe("SinFoto", () => {
  it("es decorativa y lleva la inicial en mayúscula", () => {
    const { container } = render(<SinFoto nombre="  camila rojas" id="p1" />);
    const el = container.querySelector("[data-sin-foto]") as HTMLElement;
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el.textContent).toBe("C");
    expect(el.className).toContain("portada-cielo");
  });

  it("dibuja la nube de la variante del id, siempre la misma para el mismo id", () => {
    const variante = variantePorId("perfil-7");
    const a = render(<SinFoto nombre="Ana" id="perfil-7" />).container.querySelector("img");
    const b = render(<SinFoto nombre="Zoe" id="perfil-7" />).container.querySelector("img");
    expect(a?.getAttribute("src")).toBe(`/cielo/nube-${variante}.webp`);
    expect(b?.getAttribute("src")).toBe(a?.getAttribute("src"));
  });

  it("ids distintos reparten las tres variantes (una lista no parece clonada)", () => {
    const vistas = new Set(Array.from({ length: 12 }, (_, i) => variantePorId(`perfil-${i}`)));
    expect(vistas.size).toBe(3);
  });

  it("sin id usa el nombre para elegir la nube", () => {
    const el = render(<SinFoto nombre="Lucía" />).container.querySelector("img");
    expect(el?.getAttribute("src")).toBe(`/cielo/nube-${variantePorId("Lucía")}.webp`);
  });

  it("por debajo de 36 px queda el degradé con la inicial, sin nube", () => {
    const { container } = render(<SinFoto nombre="Bar" tamano={32} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[data-sin-foto]")?.getAttribute("data-sin-foto")).toBe("liso");
    expect(container.textContent).toBe("B");
  });

  it("de 40 px en adelante la nube no desaparece", () => {
    expect(render(<SinFoto nombre="Bar" tamano={40} />).container.querySelector("img")).not.toBeNull();
  });

  it("cargando (sin nombre) deja el cielo sin letra", () => {
    const { container } = render(<SinFoto nombre="" id="x" />);
    expect(container.textContent).toBe("");
    expect(container.querySelector("img")).not.toBeNull();
  });
});

describe("SinFoto: nombres raros", () => {
  it("un nombre que empieza con emoji no se parte en medio símbolo", () => {
    const { container } = render(<SinFoto nombre="😀 Pepe" id="a" />);
    expect(container.textContent).toBe("😀");
  });
});
