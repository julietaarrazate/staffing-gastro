import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GlassIcon } from "@/components/icons";
import PortadaCielo, { variantePorId } from "./PortadaCielo";

describe("PortadaCielo", () => {
  it("elige la misma variante de nube para el mismo id, siempre", () => {
    const id = "6f1c2c1e-8a58-4b0e-9d2b-0c2f7a9a1d11";
    const primera = variantePorId(id);
    for (let i = 0; i < 20; i++) expect(variantePorId(id)).toBe(primera);
    const { container, rerender } = render(<PortadaCielo id={id} Icon={GlassIcon} />);
    expect(container.querySelector("[data-portada]")?.getAttribute("data-variante")).toBe(primera);
    rerender(<PortadaCielo id={id} Icon={GlassIcon} />);
    expect(container.querySelector("[data-portada]")?.getAttribute("data-variante")).toBe(primera);
    expect(container.querySelector("img")?.getAttribute("src")).toBe(`/cielo/nube-${primera}.webp`);
  });

  it("reparte las tres variantes entre ids distintos (una lista no parece clonada)", () => {
    const usadas = new Set<string>();
    for (let i = 0; i < 60; i++) usadas.add(variantePorId(`turno-${i}`));
    expect([...usadas].sort()).toEqual(["a", "b", "c"]);
  });

  it("es decorativa: oculta a los lectores, sin texto, con la nube sin alt", () => {
    const { container } = render(<PortadaCielo id="x" Icon={GlassIcon} />);
    const raiz = container.querySelector("[data-portada='portada']")!;
    expect(raiz.getAttribute("aria-hidden")).toBe("true");
    expect(raiz.textContent).toBe("");
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("");
    expect(container.querySelector(".portada-vidrio svg")).not.toBeNull();
  });

  it("la versión chica es sólo el degradé y el ícono: sin nube ni círculo", () => {
    const { container } = render(<PortadaCielo id="x" Icon={GlassIcon} mini />);
    const mini = container.querySelector("[data-portada='mini']")!;
    expect(mini).not.toBeNull();
    expect(mini.classList.contains("portada-cielo")).toBe(true);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".portada-vidrio")).toBeNull();
    expect(mini.querySelector("svg")).not.toBeNull();
  });

  it("en las portadas altas la nube sube a media altura, lejos del texto de abajo", () => {
    const abajo = render(<PortadaCielo id="x" Icon={GlassIcon} />).container.querySelector("img")!;
    expect(abajo.style.bottom).toMatch(/px$/);
    const medio = render(<PortadaCielo id="x" Icon={GlassIcon} nubeEn="medio" />).container.querySelector("img")!;
    expect(medio.style.bottom).toBe("34%");
  });

  it("el círculo del ícono va arriba a la derecha o al centro a la izquierda", () => {
    const a = render(<PortadaCielo id="x" Icon={GlassIcon} />).container.querySelector(".portada-vidrio")!;
    expect(a.className).toContain("right-3");
    const b = render(<PortadaCielo id="x" Icon={GlassIcon} iconoEn="centro-izq" />).container.querySelector(".portada-vidrio")!;
    expect(b.className).toContain("left-5");
  });
});
