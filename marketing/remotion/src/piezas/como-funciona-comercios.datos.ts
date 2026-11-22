// 1 · Cómo funciona para comercios (29 s): textos, tiempos (cuadros a 30 fps), cuenta y sonido.
import { PAGA, type DatosBase } from "../kit/datos";

export const escenas = {
  vibra: 6, entra: 46, toqueCampo: 74, tipeo: 80, completar: 134, donde: 140, publicar: 206, publicado: 212,
  aviso: 246, candidatos: 268, tabReco: 306, reco: 312, datos: [324, 342, 360, 378], elegir: 446, oido: 452, oidoFin: 500,
  camino: 566, camino1: 614, camino2: 652, camino3: 690, llego: 736, cierre: 782,
};

export const datos = {
  id: "como-funciona-comercios",
  titulo: "Cómo funciona para comercios",
  duracion: 870,
  cuenta: "@oidoapp",
  paga: PAGA,
  gancho: { dia: "Viernes · 19:00", de: "Mati · mozo", mensaje: "No llego a las 20, perdón.", titulo: ["Se te cayó", "el mozo."] },
  aviso: { titulo: "3 postulantes para Mozo/a", texto: "Sofía Ramírez se postuló a tu turno de Mozo/a. Entrá para ver a todos los postulantes y elegir." },
  titulos: [
    { lineas: ["Pedilo como", "lo dirías."], desde: 56, hasta: 128 },
    { lineas: ["Lo completamos", "por vos."], desde: 140, hasta: 232, acento: "vos." },
    { lineas: ["Llegan", "postulantes."], desde: 250, hasta: 300 },
    { lineas: ["Con nota, turnos", "y distancia."], desde: 310, hasta: 430, acento: "distancia." },
    { lineas: ["Elegís.", "Ella confirma."], desde: 470, hasta: 556, size: 80 },
    { lineas: ["Y la ves", "llegar."], desde: 572, hasta: 772 },
  ],
  chips: [{ texto: "Lo prende ella, sólo mientras viaja", desde: 612, hasta: 770, y: 1470, size: 32 }],
  cierre: { boton: "Publicá tu turno", bajada: "oido.com.ar" },
  escenas,
  sonido: {
    murmullo: true,
    cues: [
      ["vibracion", 6, -8], ["toque", 74, -4], ["tipeo", 80, -6, 1.5], ["toque", 134, -4], ["toque", 206, -4], ["impresora", 212, -18],
      ["vibracion", 246, -10], ["toque", 306, -6], ["toque", 324, -12], ["toque", 342, -12], ["toque", 360, -12], ["toque", 378, -12],
      ["toque", 446, -4], ["campanita", 469, -2], ["toque", 614, -14], ["toque", 652, -14], ["toque", 690, -14], ["campanita", 738, -8], ["campanita", 788, -3],
    ],
  },
} satisfies DatosBase & Record<string, unknown>;

export type Datos = typeof datos;
