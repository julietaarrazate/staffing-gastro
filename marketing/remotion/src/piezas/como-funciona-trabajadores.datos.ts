// 2 · Cómo funciona para quien trabaja (29 s).
import { PAGA, type DatosBase } from "../kit/datos";

export const escenas = {
  buscar: 52, mapaToque: 176, mapa: 182, pin: 216, pinFin: 252, lista: 282, listaV: 288, postular: 306, postulado: 312,
  aviso: 384, elegida: 426, confirmar: 522, confirmado: 528, antes: 576, voy: 636, enCamino: 642,
  terminado: 700, estrellas: [722, 728, 734, 740, 746], enviar: 772, calificado: 778, cierre: 800,
};

export const datos = {
  id: "como-funciona-trabajadores",
  titulo: "Cómo funciona para quien trabaja",
  duracion: 870,
  cuenta: "@turnosgastro",
  paga: PAGA,
  aviso: { titulo: "Te asignaron un turno", texto: 'Te asignaron el turno "Mozo/a". Confirmá tu asistencia.' },
  titulos: [
    { lineas: ["Hay turno", "a la vuelta."], desde: 2, hasta: 44, acento: "vuelta." },
    { lineas: ["Cerca, y con la", "paga a la vista."], desde: 56, hasta: 170, acento: "paga" },
    { lineas: ["En lista", "o en el mapa."], desde: 180, hasta: 296, acento: "mapa." },
    { lineas: ["Te postulás", "en un toque."], desde: 300, hasta: 378 },
    { lineas: ["Te eligieron."], desde: 388, hasta: 500, y: 280, size: 100 },
    { lineas: ["Confirmás", "y listo."], desde: 510, hasta: 570 },
    { lineas: ["Avisás que", "vas en camino."], desde: 580, hasta: 690 },
    { lineas: ["Y al final,", "calificás."], desde: 702, hasta: 792 },
  ],
  chips: [
    { texto: PAGA, desde: 14, hasta: 130, y: 1480 },
    { texto: "Lo prendés y lo apagás vos", desde: 652, hasta: 690, y: 1480, size: 32 },
  ],
  cierre: { boton: "Creá tu cuenta", bajada: "oido.com.ar" },
  escenas,
  sonido: {
    murmullo: true,
    cues: [
      ["toque", 176, -4], ["toque", 216, -4], ["toque", 282, -5], ["toque", 306, -4], ["impresora", 312, -20], ["vibracion", 384, -8],
      ["toque", 522, -4], ["campanita", 530, -6], ["toque", 636, -4], ["toque", 721, -8], ["toque", 727, -8], ["toque", 733, -8],
      ["toque", 739, -8], ["toque", 745, -8], ["toque", 772, -5], ["campanita", 806, -3],
    ],
  },
} satisfies DatosBase & Record<string, unknown>;

export type Datos = typeof datos;
