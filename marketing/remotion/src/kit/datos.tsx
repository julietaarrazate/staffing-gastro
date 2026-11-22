// Lo común a los datos de cada pieza (src/piezas/*.datos.ts). Una variante sale
// cambiando sólo los datos: textos, tiempos, cuenta, paga, llamado y sonido.
import React from "react";
import { ChipVidrio, Pop, Titular } from "./base";
import type { DatosCierre } from "./cierre";
import type { Sonido } from "./sonido";

/** La marca es @oidoapp; los turnos se publican en @turnosgastro. */
export type Cuenta = "@oidoapp" | "@turnosgastro";

export type DatosTitulo = { lineas: string[]; desde: number; hasta?: number; y?: number; size?: number; acento?: string };
export type DatosChip = { texto: string; desde: number; hasta: number; y: number; size?: number; mono?: boolean };

export type DatosBase = {
  /** id de la composición en Remotion (y nombre del archivo de salida) */
  id: string;
  titulo: string;
  /** en cuadros, a 30 fps */
  duracion: number;
  cuenta: Cuenta;
  /** cómo se habla de la paga en los textos */
  paga: string;
  titulos: DatosTitulo[];
  chips: DatosChip[];
  cierre: DatosCierre;
  sonido: Sonido;
};

export const PAGA = "Paga desde $60.000";

export const Titulos: React.FC<{ lista: DatosTitulo[]; noche?: boolean }> = ({ lista, noche }) => (
  <>
    {lista.map((t, i) => (
      <Titular key={i} lineas={t.lineas} desde={t.desde} hasta={t.hasta} y={t.y ?? 235} size={t.size ?? 88} acento={t.acento} noche={noche} />
    ))}
  </>
);

export const Chips: React.FC<{ lista: DatosChip[]; noche?: boolean }> = ({ lista, noche }) => (
  <>
    {lista.map((c, i) => (
      <Pop key={i} desde={c.desde} hasta={c.hasta} x={540} y={c.y}>
        <ChipVidrio noche={noche} mono={c.mono} style={{ fontSize: c.size ?? 34 }}>{c.texto}</ChipVidrio>
      </Pop>
    ))}
  </>
);
