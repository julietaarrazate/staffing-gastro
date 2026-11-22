// T6-05 con tomas reales de stock (prueba del 22/11 contra la versión dibujada). Mismo guion, textos y
// tiempos que sabado.datos.ts; cambia la imagen de cada escena. Tomas en tomas/FUENTES.md.
import type { DatosGuion, Toma } from "../kit/guion";
import { datos as base } from "./sabado.datos";

const tomas: Toma[] = [
  { id: "bar-lleno", desde: 2, x: 0.5 },
  { id: "mesa-desde-el-mozo", desde: 1, x: 0.62 },
  { id: "grupo-en-el-mostrador", desde: 1, x: 0.36 },
  { id: "pase-con-platos", desde: 3, x: 0.5 },
  { id: "medialuna-partida", desde: 2, x: 0.3 },
  { id: "mesa-larga", desde: 1, x: 0.35 },
  { id: "mozo-de-barra", desde: 3, x: 0.6 },
];

export const datos: DatosGuion = {
  ...base,
  id: "t6-05-sabado-real",
  escenas: base.escenas.map((e, i) => ({ ...e, dibujo: undefined, toma: tomas[i] })),
};
