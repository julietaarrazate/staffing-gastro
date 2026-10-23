// @vitest-environment node
import { describe, expect, it } from "vitest";
import { HEADERS } from "./cf-headers.mjs";

/** Reglas del `_headers` como { ruta: { cabecera: valor } }. */
function reglas(texto: string): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  let actual = "";
  for (const linea of texto.split("\n")) {
    if (!linea.trim()) continue;
    if (!/^\s/.test(linea)) {
      actual = linea.trim();
      out[actual] = {};
      continue;
    }
    const [k, ...v] = linea.trim().split(":");
    out[actual][k.trim()] = v.join(":").trim();
  }
  return out;
}

const r = reglas(HEADERS);
const UN_ANIO_INMUTABLE = "public, max-age=31536000, immutable";

describe("_headers de Cloudflare", () => {
  it("cachea un año lo que lleva hash o versión en la URL", () => {
    expect(r["/_next/static/*"]["Cache-Control"]).toBe(UN_ANIO_INMUTABLE);
    expect(r["/maplibre/*"]["Cache-Control"]).toBe(UN_ANIO_INMUTABLE);
  });

  it("a fotos y logos sin versión les da caché corta con revalidación", () => {
    for (const ruta of ["/landing/*", "/logo-*"]) {
      expect(r[ruta]["Cache-Control"]).toMatch(/max-age=86400/);
      expect(r[ruta]["Cache-Control"]).not.toMatch(/immutable/);
    }
  });

  it("no toca el service worker, el manifest ni el HTML", () => {
    for (const ruta of Object.keys(r)) {
      if (ruta === "/*") {
        expect(r[ruta]["Cache-Control"]).toBeUndefined();
        continue;
      }
      expect(ruta).not.toMatch(/sw\.js|manifest/);
    }
  });

  it("mantiene las cabeceras de seguridad y las de las imágenes de vista previa", () => {
    expect(r["/*"]["X-Content-Type-Options"]).toBe("nosniff");
    expect(r["/og/oido.jpg"]["Cache-Control"]).toBe("public, max-age=3600, must-revalidate");
    expect(r["/twitter-image"]["Content-Type"]).toBe("image/png");
  });
});
