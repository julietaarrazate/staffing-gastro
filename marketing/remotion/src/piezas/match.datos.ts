// 4 · Match, reputación y distancia (15 s). Los números son los de la persona de ejemplo en las capturas.
import { PAGA, type DatosBase } from "../kit/datos";

export const escenas = { datos: [66, 92, 118, 144], nombre: 192, ficha: 198, puntual: 236, resenas: 286, cierre: 362 };

export const datos = {
  id: "match",
  titulo: "Match, reputación y distancia",
  duracion: 450,
  cuenta: "@oidoapp",
  paga: PAGA,
  titulos: [
    { lineas: ["No elijas", "a ciegas."], desde: 2, hasta: 58, size: 104, acento: "ciegas." },
    { lineas: ["Nota, turnos", "y distancia."], desde: 64, hasta: 186 },
    { lineas: ["Su ficha,", "antes de elegir."], desde: 196, hasta: 352, acento: "ficha," },
  ],
  chips: [],
  tarjetas: {
    nota: { valor: 4.9, chico: "de calificación" },
    turnos: { valor: 38, chico: "turnos hechos" },
    distancia: { valor: 700, unidad: "m", chico: "de tu local" },
    identidad: "Identidad verificada",
    puntual: { valor: 97, chico: "puntual" },
  },
  cierre: { boton: "Publicá tu turno", bajada: "oido.com.ar" },
  escenas,
  sonido: {
    murmullo: true,
    cues: [["toque", 66, -9], ["toque", 92, -9], ["toque", 118, -9], ["toque", 144, -9], ["toque", 192, -4], ["toque", 236, -9], ["campanita", 368, -3]],
  },
} satisfies DatosBase & Record<string, unknown>;

export type Datos = typeof datos;
