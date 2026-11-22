// T6-05 con tomas reales de stock (prueba del 22/11 contra la versión dibujada). Mismo guion, textos y
// tiempos que sabado.datos.ts; cambia la imagen de cada escena. Tomas en tomas/FUENTES.md.
import type { DatosGuion, Toma } from "../kit/guion";
import type { Cue } from "../kit/sonido";
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
  // Sonido con más vida (pedido de Julieta, 22/11): bar repleto al arranque, restaurante de fondo,
  // golpe en cada corte, pop cuando aparece cada texto, un efecto por escena y jazz alegre más presente.
  sonido: {
    murmullo: false, musica: "upbeat-jazz", musicaDesde: 40, musicaDb: 12,
    ambiente: [["bar-lleno", 0, 80, 3], ["restaurante", 60, 750, 0]],
    cues: [
      ...[62, 146, 236, 326, 416, 536, 656].map((f): Cue => ["whoosh", f, -12]),
      ...[3, 69, 153, 243, 333, 423, 543].map((f): Cue => ["pop", f, -10]),
      ["cubiertos", 95, -6], ["puerta-campanita", 152, -8], ["risas", 185, -10],
      ["campana-pase", 250, -2], ["campana-pase", 262, -5], ["plato", 288, -9], ["platos-cocina", 300, -12],
      ["plato-suave", 345, -6], ["copas", 440, -8], ["copa-clink", 482, -8], ["plato-suave", 565, -6], ["pop", 606, -8],
      ["campanitas", 666, -6],
    ],
  },
};
