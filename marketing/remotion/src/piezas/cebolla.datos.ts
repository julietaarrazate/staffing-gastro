// T3-05 · Una cebolla en 20 segundos (@turnosgastro, 3/12, 28 s). Tip con chiste: se guarda.
// Nota del guion: si hay manos, los dedos de la mano que sostiene van doblados. Acá no hay manos: es dibujo.
import type { DatosGuion } from "../kit/guion";

export const datos: DatosGuion = {
  id: "t3-05-cebolla",
  codigo: "T3-05",
  titulo: "Una cebolla en 20 segundos",
  fecha: "3/12",
  duracion: 28,
  cuenta: "@turnosgastro",
  escenas: [
    { desde: 0, hasta: 2.4, lineas: ["Si llorás picando cebolla,", "no es la cebolla:", "es el cuchillo"], size: 64, acento: "cuchillo", dibujo: "entera" },
    { desde: 2.4, hasta: 5, lineas: ["1. Al medio, de la raíz", "a la punta.", "La raíz no se toca."], size: 64, dibujo: "mitad" },
    { desde: 5, hasta: 9, lineas: ["2. Pelá y apoyá", "la parte plana"], dibujo: "plana" },
    { desde: 9, hasta: 13, lineas: ["3. Cortes verticales", "sin llegar a la raíz"], size: 70, dibujo: "verticales" },
    { desde: 13, hasta: 17, lineas: ["4. Uno o dos cortes", "horizontales"], dibujo: "horizontales" },
    { desde: 17, hasta: 21, lineas: ["5. De costado:", "sale pareja"], dibujo: "costado" },
    { desde: 21, hasta: 25, lineas: ["Cuchillo afilado y cebolla fría.", "Para llorar ya está", "el cierre del domingo."], size: 58, dibujo: "frio" },
  ],
  cierre: { desde: 25, lineas: ["Guardalo para tu próximo", "turno en cocina"], size: 68, logo: "pinche" },
  sonido: {
    murmullo: true, murmulloDb: -5, musicaDesde: 60,
    cues: [["tabla", 96, -10, 0.5], ["tabla", 290, -6], ["tabla", 420, -8, 1.2], ["tabla", 525, -6], ["tabla", 580, -8]],
  },
};
