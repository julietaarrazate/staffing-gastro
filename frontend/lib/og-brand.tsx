import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * La imagen que acompaña un link de Oído al compartirlo (WhatsApp, Slack, X).
 * Generada desde el código y no un PNG commiteado: si cambia la marca, se
 * cambia acá (colores y textos de abajo) o el SVG de `public/logo-mark.svg`.
 *
 * Es sólo la marca, centrada: el isotipo grande, el wordmark y el tagline.
 * La versión anterior (hasta 2026-10-05) era apaisada con el logo a la
 * izquierda y una tarjeta de turno a la derecha, y en WhatsApp se veía como
 * "un pedazo recortado del ticket": WhatsApp la mostraba como miniatura
 * cuadrada recortando el centro, que caía justo entre las dos mitades y
 * dejaba afuera el logo. Centrada, cualquier recorte cuadrado la conserva.
 *
 * Dos formatos: cuadrado para `og:image` (lo que WhatsApp, Facebook e
 * iMessage leen), servido como JPEG en `app/og/oido.jpg/route.ts`, y
 * apaisado para `twitter:image` (X recorta a 2:1).
 */
const LIENZO = "#fbfaf6";
const TINTA = "#111111";
const AMBAR_TEXTO = "#b45309";
const WORDMARK = "oído";
const TAGLINE = "Personal gastronómico,";
const TAGLINE_ACENTO = "ya.";

export { OG_ALT, OG_SQUARE, OG_WIDE } from "./og";

export async function renderBrandImage(size: { width: number; height: number }) {
  const root = process.cwd();
  const [fraunces, inter, logo] = await Promise.all([
    readFile(join(root, "assets/og/Fraunces-SemiBold.ttf")),
    readFile(join(root, "assets/og/Inter-SemiBold.ttf")),
    readFile(join(root, "public/logo-mark.svg"), "utf8"),
  ]);
  const logoSrc = `data:image/svg+xml;base64,${Buffer.from(logo).toString("base64")}`;

  // Todo escala con el lado corto: el mismo diseño entra en 1200×1200 y en
  // 1200×630 sin tocar nada más.
  const u = Math.min(size.width, size.height) / 100;
  const logoSize = Math.round(u * 40);

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
          background: LIENZO,
          fontFamily: "Inter",
          color: TINTA,
        }}
      >
        <img
          src={logoSrc}
          width={logoSize}
          height={logoSize}
          alt=""
          style={{ borderRadius: logoSize * 0.215, boxShadow: "0 16px 48px rgba(17,17,17,0.16)" }}
        />
        <div
          style={{
            fontFamily: "Fraunces",
            fontSize: Math.round(u * 17),
            lineHeight: 1,
            marginTop: Math.round(u * 5),
            letterSpacing: -2,
          }}
        >
          {WORDMARK}
        </div>
        <div style={{ display: "flex", fontSize: Math.round(u * 5.6), marginTop: Math.round(u * 2.6) }}>
          {TAGLINE}&nbsp;<span style={{ color: AMBAR_TEXTO }}>{TAGLINE_ACENTO}</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Fraunces", data: fraunces, weight: 600, style: "normal" },
        { name: "Inter", data: inter, weight: 600, style: "normal" },
      ],
    }
  );
}
