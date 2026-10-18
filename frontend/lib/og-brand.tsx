import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * La imagen que acompaña un link de Oído al compartirlo (WhatsApp, Slack, X).
 * Generada desde el código y no un PNG entero commiteado: si cambia la marca,
 * se cambia acá (colores y textos de abajo) o el filete de
 * `assets/og/filete-oido.png`.
 *
 * Desde el 2026-10-18 sigue a la landing "cielo": la palabra "oído" fileteada (la misma de `components/landing/Filete.tsx`, guardada
 * como PNG porque satori no dibuja texto dentro de un SVG) y el tagline,
 * sobre el cielo celeste. Sin el isotipo (Julieta): el ícono ya lo muestra la
 * app y su ámbar competía con el del filete. Todo centrado: hasta el 2026-10-05 era apaisada
 * con el logo a la izquierda y una tarjeta de turno a la derecha, y en
 * WhatsApp se veía como "un pedazo recortado del ticket": WhatsApp la
 * mostraba como miniatura cuadrada recortando el centro, que caía justo
 * entre las dos mitades y dejaba afuera el logo. Centrada, cualquier recorte
 * cuadrado la conserva.
 *
 * Dos formatos: cuadrado para `og:image` (lo que WhatsApp, Facebook e
 * iMessage leen), servido como JPEG en `app/og/oido.jpg/route.ts`, y
 * apaisado para `twitter:image` (X recorta a 2:1).
 */
export const LIENZO = "#c4e3ed";
const CIELO = "radial-gradient(120% 80% at 50% 0%, #ffffff 0%, #e4f2f8 35%, #c4e3ed 65%, #9ac9e7 100%)";
const TINTA = "#111111";
const AMBAR_TEXTO = "#b45309";
const TAGLINE = "Personal gastronómico,";
const TAGLINE_ACENTO = "ya.";
/** Proporción del PNG del filete (1200 × 428). */
const FILETE_ALTO = 428 / 1200;

export { OG_ALT, OG_SQUARE, OG_WIDE } from "./og";

export async function renderBrandImage(size: { width: number; height: number }) {
  const root = process.cwd();
  const [inter, filete] = await Promise.all([
    readFile(join(root, "assets/og/Inter-SemiBold.ttf")),
    readFile(join(root, "assets/og/filete-oido.png")),
  ]);
  const fileteSrc = `data:image/png;base64,${filete.toString("base64")}`;

  // Todo escala con el lado corto: el mismo diseño entra en 1200×1200 y en
  // 1200×630 sin tocar nada más.
  const u = Math.min(size.width, size.height) / 100;
  const fileteAncho = Math.round(u * 90);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: LIENZO,
          backgroundImage: CIELO,
          fontFamily: "Inter",
          color: TINTA,
        }}
      >
        <img
          src={fileteSrc}
          width={fileteAncho}
          height={Math.round(fileteAncho * FILETE_ALTO)}
          alt=""
        />
        <div style={{ display: "flex", fontSize: Math.round(u * 5.4), marginTop: Math.round(u * 3) }}>
          {TAGLINE}&nbsp;<span style={{ color: AMBAR_TEXTO }}>{TAGLINE_ACENTO}</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Inter", data: inter, weight: 600, style: "normal" }],
    }
  );
}
