// T6-05 con tomas reales de stock (prueba del 22/11 contra la versión de láminas). Mismos textos, tiempos
// y cierre que `sabado` (diciembre.datos.ts); cambian la imagen de cada escena y el sonido.
import type { Toma } from "../kit/toma";
import type { Cue, Sonido } from "../kit/sonido";
import { sabado } from "./diciembre.datos";

/** Una toma por escena de `sabado.escenas` (tomas/FUENTES.md). */
const tomas: Toma[] = [
  { id: "bar-lleno", desde: 2, x: 0.5 },
  { id: "mesa-desde-el-mozo", desde: 1, x: 0.62 },
  { id: "grupo-en-el-mostrador", desde: 1, x: 0.36 },
  { id: "pase-con-platos", desde: 3, x: 0.5 },
  { id: "medialuna-partida", desde: 2, x: 0.3 },
  { id: "mesa-larga", desde: 1, x: 0.35 },
  { id: "mozo-de-barra", desde: 3, x: 0.6 },
];

const cortes = [...sabado.escenas.slice(1), sabado.cierre];

// Sonido con más vida (pedido de Julieta, 22/11): bar repleto al arranque, restaurante de fondo, golpe en
// cada corte, pop cuando aparece cada texto, un efecto por escena y jazz alegre más presente.
const sonido: Sonido = {
  murmullo: false, musica: "upbeat-jazz", musicaDesde: 40, musicaDb: 12,
  ambiente: [["bar-lleno", 0, 80, 3], ["restaurante", 56, sabado.duracion, 0]],
  cues: [
    ...cortes.map((f): Cue => ["whoosh", f - 4, -12]),
    ...sabado.titulos.map((t): Cue => ["pop", t.desde + 3, -10]),
    ["cubiertos", 95, -6], ["puerta-campanita", 152, -8], ["risas", 185, -10],
    ["campana-pase", 250, -2], ["campana-pase", 262, -5], ["plato", 288, -9], ["platos-cocina", 300, -12],
    ["plato-suave", 345, -6], ["copas", 440, -8], ["copa-clink", 482, -8], ["plato-suave", 565, -6],
    ["campanitas", sabado.cierre + 6, -6],
  ],
};

export const sabadoReal = { ...sabado, id: "t6-05-sabado-real", titulo: sabado.titulo + " (tomas reales)", tomas, sonido };
