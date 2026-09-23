import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * Vista previa de 1200×630 de cualquier link de Oído (WhatsApp, Slack, X).
 * Generada desde el código y no un PNG commiteado: el anterior se armó a mano
 * una sola vez, sin fuente vectorial, y quedó con el naranja y el wordmark sans
 * de antes del rebrand. Así, si cambia la marca, cambia acá y listo.
 *
 * Mismos valores que `globals.css` (tema claro): lienzo #fbfaf6, tinta #111,
 * ámbar #d97706 en el tile y #b45309 como texto sobre claro (AA). Wordmark en
 * Fraunces, como el `Logo` de la app. Las fuentes viven en `assets/og/`
 * (OFL) para que el build no dependa de la red.
 */
export const alt = "oído — Personal gastronómico, ya.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const root = process.cwd();
  const [fraunces, inter, logo] = await Promise.all([
    readFile(join(root, "assets/og/Fraunces-SemiBold.ttf")),
    readFile(join(root, "assets/og/Inter-SemiBold.ttf")),
    readFile(join(root, "public/logo-mark.svg"), "utf8"),
  ]);
  const logoSrc = `data:image/svg+xml;base64,${Buffer.from(logo).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#fbfaf6",
          fontFamily: "Inter",
          color: "#111111",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 0 0 96px", width: 640 }}>
          <img src={logoSrc} width={132} height={132} alt="" style={{ borderRadius: 30 }} />
          <div style={{ fontFamily: "Fraunces", fontSize: 112, lineHeight: 1, marginTop: 40, letterSpacing: -2 }}>
            oído
          </div>
          <div style={{ display: "flex", fontSize: 38, marginTop: 22, color: "#111111" }}>
            Personal gastronómico,&nbsp;<span style={{ color: "#b45309" }}>ya.</span>
          </div>
        </div>

        {/* Lo que la app hace, en una imagen: un turno con su pago en el pin
            (el lenguaje del mapa) sobre el verde bosque de "Recomendado". */}
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", paddingRight: 80 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: 400,
              padding: 36,
              borderRadius: 32,
              background: "#1b3a31",
              color: "#ffffff",
              boxShadow: "0 24px 60px rgba(17,17,17,0.18)",
            }}
          >
            <div style={{ fontSize: 20, letterSpacing: 2, color: "#d97706" }}>TURNO CERCA TUYO</div>
            <div style={{ fontFamily: "Fraunces", fontSize: 54, marginTop: 14 }}>Mozo/a</div>
            <div style={{ fontSize: 26, marginTop: 8, color: "rgba(255,255,255,0.75)" }}>Hoy · 20:00 – 02:00</div>
            <div style={{ display: "flex", marginTop: 34 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "12px 24px",
                  borderRadius: 999,
                  background: "#d97706",
                  color: "#111111",
                  fontSize: 34,
                  border: "4px solid #ffffff",
                }}
              >
                $45.000
              </div>
            </div>
          </div>
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
