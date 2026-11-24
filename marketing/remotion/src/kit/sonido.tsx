// La mezcla de sonido, dentro de cada composición: murmullo de salón de fondo,
// efectos en su cuadro y la música (bossa, una persona tocando, CC0) muy por debajo.
// Los archivos están en sonidos/ (ver sonidos/FUENTES.md) y `npm run preparar` los copia a public/.
// Efectos: recortes con pico a -3 dBFS. Murmullo y música: -23 LUFS. Las ganancias de abajo son
// relativas a eso; el volumen final (-14 LUFS) lo pone scripts/renderizar.sh.
// Además, música y efectos de Mixkit (public/sonidos/mixkit/, `bash sonidos/bajar-mixkit.sh`): cada uno
// lleva su corrección para quedar en el mismo nivel que los recortes propios (MIXKIT, medida con ebur128).
import React from "react";
import { Audio, getInputProps, interpolate, Sequence, staticFile, useVideoConfig } from "remotion";

export type EfectoPropio = "toque" | "campanita" | "vibracion" | "tipeo" | "impresora" | "hielo" | "coctelera" | "cuchillo" | "copa";
export type EfectoMixkit = "whoosh" | "pop" | "cubiertos" | "puerta-campanita" | "risas" | "campana-pase" | "plato" | "platos-cocina" | "copas" | "copa-clink" | "plato-suave" | "campanitas";
export type Efecto = EfectoPropio | EfectoMixkit;
export type Ambiente = "bar-lleno" | "restaurante";
/** [ambiente, desde (cuadro), hasta (cuadro), ganancia en dB] */
export type TramoAmbiente = [Ambiente, number, number, number];
/** [efecto, cuadro, ganancia en dB, duración en s (opcional)] */
export type Cue = [Efecto, number, number, number?];
/**
 * `musicaDesde`: cuadro en que arranca la música (por defecto, al principio); `murmulloDb`: ajuste del murmullo.
 * `musica`: "bossa" (la propia, por defecto) o "upbeat-jazz" (Mixkit); `musicaDb`: ajuste de la música.
 * `ambiente`: tramos de ambiente de Mixkit (bar lleno, restaurante), con fundidos.
 */
export type Sonido = { murmullo: boolean; cues: Cue[]; musicaDesde?: number; murmulloDb?: number; musica?: "bossa" | "upbeat-jazz"; musicaDb?: number; ambiente?: TramoAmbiente[] };

const ARCHIVO: Record<Efecto, string> = {
  toque: "toque.mp3", campanita: "campanita.mp3", vibracion: "vibracion.mp3", tipeo: "tipeo.mp3", impresora: "impresora-corta.mp3",
  hielo: "hielo.mp3", coctelera: "coctelera.mp3", cuchillo: "cuchillo.mp3", copa: "copa.mp3",
  whoosh: "mixkit/whoosh.mp3", pop: "mixkit/pop.mp3", cubiertos: "mixkit/cubiertos.mp3", "puerta-campanita": "mixkit/puerta-campanita.mp3",
  risas: "mixkit/risas.mp3", "campana-pase": "mixkit/campana-pase.mp3", plato: "mixkit/plato.mp3", "platos-cocina": "mixkit/platos-cocina.mp3",
  copas: "mixkit/copas.mp3", "copa-clink": "mixkit/copa-clink.mp3", "plato-suave": "mixkit/plato-suave.mp3", campanitas: "mixkit/campanitas.mp3",
};
const DUR: Record<Efecto, number> = { toque: 0.45, campanita: 1.99, vibracion: 1.3, tipeo: 1.9, impresora: 0.55, hielo: 2.1, coctelera: 3.8, cuchillo: 3.7, copa: 0.95,
  whoosh: 1.2, pop: 0.34, cubiertos: 1.2, "puerta-campanita": 2.5, risas: 3, "campana-pase": 1.2, plato: 1.2, "platos-cocina": 4,
  copas: 2.6, "copa-clink": 1.2, "plato-suave": 1.1, campanitas: 3,
};
/** Corrección de nivel de cada archivo de Mixkit: efectos a pico -3 dBFS, ambientes y música a -23 LUFS. */
const MIXKIT: Record<string, number> = {
  whoosh: -2, pop: 2, cubiertos: 13, "puerta-campanita": -3, risas: -1, "campana-pase": -3, plato: -3, "platos-cocina": 2,
  copas: 5.5, "copa-clink": -2, "plato-suave": 16, campanitas: -1.5, "bar-lleno": -7.4, restaurante: -1.4, "upbeat-jazz": -11.4,
};

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
  const fundido = (f: number, entra: number, sale: number, g: number, ini = 0) =>
    lin(g) * interpolate(f, [ini, ini + entra, fin - sale, fin], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <>
      {s.murmullo && va("murmullo") && <Audio src={staticFile("sonidos/murmullo.mp3")} volume={(f) => fundido(f, 15, 36, GANANCIA.murmullo + (s.murmulloDb ?? 0))} />}
      {va("murmullo") && (s.ambiente ?? []).map(([a, desde, hasta, db], i) => (
        <Sequence key={"a" + i} from={desde} durationInFrames={hasta - desde} layout="none">
          <Audio src={staticFile(`sonidos/mixkit/${a}.mp3`)} loop
            volume={(f) => lin(GANANCIA.murmullo + MIXKIT[a] + db) * interpolate(f, [0, 8, hasta - desde - 10, hasta - desde], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
        </Sequence>
      ))}
      {conMusica && va("musica") && (
        <Sequence from={s.musicaDesde ?? 0} layout="none">
          <Audio src={staticFile(!s.musica || s.musica === "bossa" ? "sonidos/bossa.mp3" : `sonidos/mixkit/${s.musica}.mp3`)}
            volume={(f) => fundido(f + (s.musicaDesde ?? 0), 30, 45, GANANCIA.musica + (s.musica && s.musica !== "bossa" ? MIXKIT[s.musica] : 0) + (s.musicaDb ?? 0), s.musicaDesde ?? 0)} />
        </Sequence>
      )}
      {va("efectos") && s.cues.map(([e, cuadro, db, d], i) => {
        const dur = Math.round((d ?? DUR[e]) * fps);
        return (
          <Sequence key={i} from={cuadro} durationInFrames={dur} layout="none">
            <Audio src={staticFile(`sonidos/${ARCHIVO[e]}`)}
              volume={(f) => lin(GANANCIA.efectos + (MIXKIT[e] ?? 0) + db) * interpolate(f, [0, dur - 4, dur], [1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
          </Sequence>
        );
      })}
    </>
  );
};
