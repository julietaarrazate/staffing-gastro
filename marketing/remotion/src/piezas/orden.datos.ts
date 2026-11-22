// T1-04 · El orden de servicio que nadie te explicó (@turnosgastro, 4/12, 28 s). Tip con chiste: se guarda.
import type { DatosGuion } from "../kit/guion";

export const datos: DatosGuion = {
  id: "t1-04-orden-servicio",
  codigo: "T1-04",
  titulo: "El orden de servicio que nadie te explicó",
  fecha: "4/12",
  duracion: 28,
  cuenta: "@turnosgastro",
  escenas: [
    { desde: 0, hasta: 2.4, lineas: ["Mesa de 4, cuatro platos,", "dos manos.", "¿Por qué lado entro?"], size: 64, dibujo: "mesa4" },
    { desde: 2.4, hasta: 7, lineas: ["Plato: por la derecha", "del cliente"], acento: "derecha", dibujo: "plato" },
    { desde: 7, hasta: 11, lineas: ["Bebida: por la derecha,", "copa a la derecha", "del plato"], size: 70, acento: "derecha,", dibujo: "bebida" },
    { desde: 11, hasta: 15, lineas: ["Pan y manteca:", "a la izquierda"], acento: "izquierda", dibujo: "pan" },
    { desde: 15, hasta: 20, lineas: ["Primero los invitados;", "el que paga, al final"], size: 70, nota: "(que espere, total paga)", notaEn: 2, dibujo: "orden" },
    { desde: 20, hasta: 24, lineas: ["Se retira cuando", "terminaron todos."], nota: "Sí, aunque el de la punta tarde 40 minutos.", notaEn: 1.4, dibujo: "retira" },
  ],
  cierre: { desde: 24, lineas: ["Cada casa tiene su manual.", "Esto es lo más usado.", "Guardalo."], size: 60, logo: "pinche" },
  sonido: {
    murmullo: true, musicaDesde: 60,
    cues: [["copa", 252, -6], ["copa", 402, -10], ["toque", 470, -14], ["toque", 495, -14], ["toque", 520, -14], ["toque", 560, -10], ["campanita", 732, -4]],
  },
};
