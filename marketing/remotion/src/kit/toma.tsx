// Tomas reales de stock a pantalla completa (video gratis de Mixkit, sólo «Stock Video Free License»;
// lista en tomas/FUENTES.md, `bash tomas/bajar-tomas.sh` las baja a public/tomas/). El texto va en una
// hoja blanca arriba (zona segura de títulos) para que se lea sobre cualquier imagen.
import React from "react";
import { interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Titular } from "./base";
import type { DatosTitulo } from "./datos";

/** Una toma: archivo public/tomas/<id>.mp4, desde qué segundo del clip, encuadre horizontal (0 izq, 0,5 centro, 1 der) y zoom. */
export type Toma = { id: string; desde?: number; x?: number; zoom?: number; vel?: number };

// El clip 16:9 recortado a vertical, con un zoom lento, fundido de entrada y salida y un velo suave arriba y abajo.
export const TomaVideo: React.FC<{ toma: Toma; desde: number; hasta: number }> = ({ toma, desde, hasta }) => {
  const frame = useCurrentFrame();
  if (frame < desde - 1 || frame > hasta + 6) return null;
  const t = frame - desde, dur = hasta - desde;
  const op = interpolate(frame, [desde, desde + 6, hasta, hasta + 6], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const z = (toma.zoom ?? 1) * (1.0 + 0.08 * (t / Math.max(1, dur)));
  const ancho = 1920 * (16 / 9) * z, alto = 1920 * z;
  const x = -(ancho - 1080) * (toma.x ?? 0.5), y = -(alto - 1920) / 2;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 3, opacity: op, overflow: "hidden", background: "#0B1A28" }}>
      <Sequence from={desde} durationInFrames={hasta - desde + 6} layout="none">
        <OffthreadVideo src={staticFile(`tomas/${toma.id}.mp4`)} muted startFrom={Math.round((toma.desde ?? 0) * 30)} playbackRate={toma.vel ?? 1}
          style={{ position: "absolute", left: x, top: y, width: ancho, height: alto }} />
      </Sequence>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(11,26,40,.45), rgba(11,26,40,0) 30%, rgba(11,26,40,0) 70%, rgba(11,26,40,.45))" }} />
    </div>
  );
};

// El título sobre una toma: la hoja blanca de la app con el texto palabra por palabra.
export const TituloHoja: React.FC<{ t: DatosTitulo }> = ({ t: { lineas, desde, hasta = desde + 60, size = 84, acento } }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < desde - 1 || frame > hasta + 12) return null;
  const s = spring({ frame: frame - desde, fps, config: { damping: 18, stiffness: 160 } });
  const o = interpolate(frame, [hasta, hasta + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const alto = lineas.length * size * 1.06 + 70;
  return (
    <>
      <div style={{ position: "absolute", left: 60, right: 60, top: 400 - alto / 2, height: alto, zIndex: 5, borderRadius: 40, background: "rgba(255,255,255,.94)",
        boxShadow: "0 20px 50px rgba(11,26,40,.35)", opacity: Math.min(1, s * 1.5) * (1 - o), transform: `translateY(${(1 - s) * -30}px) scale(${0.96 + 0.04 * s})` }} />
      <Titular lineas={lineas} desde={desde + 3} hasta={hasta} y={400 - alto / 2 + 35} size={size} acento={acento} izq={90} />
    </>
  );
};
