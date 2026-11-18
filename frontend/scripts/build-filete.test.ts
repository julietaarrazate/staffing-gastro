// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { ADORNOS_CAJA, ADORNOS_SVG } from "../components/landing/filete-adornos";
import { OG_FILETE } from "../lib/og";
import { adornos, moduloTs, vector } from "./build-filete.mjs";

const raiz = join(import.meta.dirname, "..");
const marca = join(raiz, "..", "docs", "design-system", "marca");

describe("los adornos del filete", () => {
  it("lo commiteado es lo que escribe el script (si falla: node scripts/build-filete.mjs)", () => {
    expect(readFileSync(join(raiz, "components/landing/filete-adornos.ts"), "utf8")).toBe(moduloTs());
    expect(readFileSync(join(marca, "oido-filete.svg"), "utf8")).toBe(vector("medio"));
    expect(readFileSync(join(marca, "oido-filete-cargado.svg"), "utf8")).toBe(vector("cargado"));
  });

  it("el dibujo que Filete.tsx inserta como HTML sólo trae formas y pintura", () => {
    // Va por dangerouslySetInnerHTML: que no pueda colarse nada que ejecute.
    const etiquetas = new Set([...ADORNOS_SVG.matchAll(/<([a-zA-Z]+)/g)].map((m) => m[1]));
    const permitidas = ["defs", "linearGradient", "radialGradient", "stop", "filter", "feGaussianBlur", "g", "path", "circle", "use"];
    expect([...etiquetas].filter((e) => !permitidas.includes(e))).toEqual([]);
    expect(ADORNOS_SVG).not.toMatch(/\son[a-z]+=|javascript:|<script|style=/i);
    // Los únicos enlaces son a la silueta del propio dibujo.
    const enlaces = [...ADORNOS_SVG.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
    expect(enlaces.every((h) => /^#__ID__-sil[FG]$/.test(h))).toBe(true);
  });

  it("cada copia lleva sus propios ids", () => {
    const ids = [...ADORNOS_SVG.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => id.startsWith("__ID__-"))).toBe(true);
    const refs = [...ADORNOS_SVG.matchAll(/url\(#([^)]+)\)|href="#([^"]+)"/g)].map((m) => m[1] ?? m[2]);
    expect(refs.length).toBeGreaterThan(0);
    expect(refs.every((r) => ids.includes(r))).toBe(true);
  });

  it("el dibujo entra en su caja y deja lugar para la palabra", () => {
    const [x, y, ancho, alto] = ADORNOS_CAJA.split(" ").map(Number);
    // La palabra se dibuja centrada en x = 410 (Filete.tsx).
    expect(x + ancho / 2).toBe(410);
    expect(y).toBeLessThan(40);
    expect(y + alto).toBeGreaterThan(370);
  });

  it("la miniatura usa el nivel cargado, con las medidas de lib/og.ts", async () => {
    const [, , ancho, alto] = adornos("cargado").caja.split(" ").map(Number);
    const png = await sharp(join(raiz, "assets/og/filete-oido.png")).metadata();
    expect({ width: png.width, height: png.height }).toEqual(OG_FILETE);
    expect(Math.round((OG_FILETE.width * alto) / ancho)).toBe(OG_FILETE.height);
    expect(vector("cargado")).toContain("clipPath"); // la cinta sólo está en el cargado
    expect(ADORNOS_SVG).not.toContain("clipPath");
  });
});
