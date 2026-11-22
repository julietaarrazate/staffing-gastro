// La mezcla de sonido, dentro de cada composición: murmullo de salón de fondo,
// efectos en su cuadro y la música (bossa, una persona tocando, CC0) muy por debajo.
// Los archivos están en sonidos/ (ver sonidos/FUENTES.md) y `npm run preparar` los copia a public/.
// Efectos: recortes con pico a -3 dBFS. Murmullo y música: -23 LUFS. Las ganancias de abajo son
// relativas a eso; el volumen final (-14 LUFS) lo pone scripts/renderizar.sh.
import React from "react";
import { Audio, getInputProps, interpolate, Sequence, staticFile, useVideoConfig } from "remotion";

export type Efecto = "toque" | "campanita" | "vibracion" | "tipeo" | "impresora" | "hielo" | "coctelera" | "tabla" | "copa";
/** [efecto, cuadro, ganancia en dB, duración en s (opcional)] */
export type Cue = [Efecto, number, number, number?];
/** `musicaDesde`: cuadro en que entra la música (los guiones la piden a los 2 s); `murmulloDb`: ajuste del murmullo. */
export type Sonido = { murmullo: boolean; cues: Cue[]; musicaDesde?: number; murmulloDb?: number };

const ARCHIVO: Record<Efecto, string> = {
  toque: "toque.mp3", campanita: "campanita.mp3", vibracion: "vibracion.mp3", tipeo: "tipeo.mp3", impresora: "impresora-corta.mp3",
  hielo: "hielo.mp3", coctelera: "coctelera.mp3", tabla: "tabla.mp3", copa: "copa.mp3",
};
const DUR: Record<Efecto, number> = { toque: 0.45, campanita: 1.99, vibracion: 1.3, tipeo: 1.9, impresora: 0.55, hielo: 1.8, coctelera: 2, tabla: 2.1, copa: 0.6 };

// Balance (medido por pista con scripts/niveles.sh): la música queda 15–18 dB debajo de los efectos.
export const GANANCIA = { efectos: 0, murmullo: -7, musica: -14 };
const lin = (db: number) => Math.pow(10, db / 20);

type Pista = "todo" | "efectos" | "murmullo" | "musica";

// Adentro de una historia, la pieza larga que se reusa no suena: suena la mezcla de la historia.
export const MudoContexto = React.createContext(false);

export const Mezcla: React.FC<{ s: Sonido }> = ({ s }) => {
  const mudo = React.useContext(MudoContexto);
  const { fps, durationInFrames } = useVideoConfig();
  if (mudo) return null;
  const p = getInputProps() as { musica?: boolean; pista?: Pista };
  const pista: Pista = p.pista || "todo";
  const conMusica = p.musica !== false;
  const va = (x: Pista) => pista === "todo" || pista === x;
  const fin = durationInFrames;
  const fundido = (f: number, entra: number, sale: number, g: number) =>
    lin(g) * interpolate(f, [0, entra, fin - sale, fin], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <>
      {s.murmullo && va("murmullo") && <Audio src={staticFile("sonidos/murmullo.mp3")} volume={(f) => fundido(f, 15, 36, GANANCIA.murmullo + (s.murmulloDb ?? 0))} />}
      {conMusica && va("musica") && (
        <Sequence from={s.musicaDesde ?? 0} layout="none">
          <Audio src={staticFile("sonidos/bossa.mp3")} volume={(f) => fundido(f + (s.musicaDesde ?? 0), (s.musicaDesde ?? 0) + 30, 45, GANANCIA.musica)} />
        </Sequence>
      )}
      {va("efectos") && s.cues.map(([e, cuadro, db, d], i) => {
        const dur = Math.round((d ?? DUR[e]) * fps);
        return (
          <Sequence key={i} from={cuadro} durationInFrames={dur} layout="none">
            <Audio src={staticFile(`sonidos/${ARCHIVO[e]}`)}
              volume={(f) => lin(GANANCIA.efectos + db) * interpolate(f, [0, dur - 4, dur], [1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
          </Sequence>
        );
      })}
    </>
  );
};
