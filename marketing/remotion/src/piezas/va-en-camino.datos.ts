// 5 · Va en camino (14 s), de noche. Lo que se ve es la última posición y una línea recta, como en la app.
import { PAGA, type DatosBase } from "../kit/datos";

export const escenas = { c1: 84, c2: 138, c3: 192, llego: 252, cierre: 334 };

export const datos = {
  id: "va-en-camino",
  titulo: "Va en camino",
  duracion: 420,
  cuenta: "@oidoapp",
  paga: PAGA,
  titulos: [
    { lineas: ["¿Llega", "a las 20?"], desde: 2, hasta: 60, size: 104 },
    { lineas: ["Ves cuánto", "le falta."], desde: 68, hasta: 244, acento: "falta." },
    { lineas: ["Llegó."], desde: 256, hasta: 326, y: 270, size: 120 },
  ],
  horas: ["Viernes · 19:31", "Viernes · 19:38", "Viernes · 19:45", "Viernes · 19:51", "Viernes · 19:53"],
  chips: [
    { texto: "Lo prende ella, sólo mientras viaja", desde: 96, hasta: 244, y: 1500, size: 38 },
    { texto: "Se ve su última posición, nunca el recorrido", desde: 128, hasta: 244, y: 1590, size: 33 },
  ],
  cierre: { boton: "Publicá tu turno", bajada: "oido.com.ar" },
  escenas,
  sonido: {
    murmullo: true,
    cues: [["toque", 84, -12], ["toque", 138, -12], ["toque", 192, -12], ["vibracion", 252, -14], ["campanita", 254, -4], ["campanita", 340, -6]],
  },
} satisfies DatosBase & Record<string, unknown>;

export type Datos = typeof datos;
