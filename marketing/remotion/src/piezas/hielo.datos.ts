// T2-09 · El hielo es la mitad del trago (@turnosgastro, 2/12, 29 s). Tip con chiste: se guarda.
import type { DatosGuion } from "../kit/guion";

export const datos: DatosGuion = {
  id: "t2-09-hielo",
  codigo: "T2-09",
  titulo: "El hielo es la mitad del trago",
  fecha: "2/12",
  duracion: 29,
  cuenta: "@turnosgastro",
  escenas: [
    { desde: 0, hasta: 2.4, lineas: ["«Sin mucho hielo,", "que me cobrás agua»"], nota: "La física: no.", notaEn: 1.1, dibujo: "dosVasos" },
    { desde: 2.4, hasta: 7, lineas: ["Poco hielo se derrite", "rápido y agua el trago.", "Vaso lleno: frío y entero."], size: 62, dibujo: "derrite" },
    { desde: 7, hasta: 12, lineas: ["Cubo grande:", "whisky, Negroni"], acento: "grande:", dibujo: "cuboGrande" },
    { desde: 12, hasta: 17, lineas: ["Cubos comunes:", "gin tonic, fernet"], acento: "comunes:", dibujo: "cubosComunes" },
    { desde: 17, hasta: 22, lineas: ["Hielo picado:", "Mojito"], acento: "picado:", dibujo: "picado" },
    { desde: 22, hasta: 26, lineas: ["El de la coctelera se tira.", "Servís con hielo nuevo."], size: 62, dibujo: "colador" },
  ],
  cierre: { desde: 26, lineas: ["Mandaselo a quien", "te pide «poquito hielo»"], size: 68, logo: "pinche" },
  sonido: {
    murmullo: true, murmulloDb: -2, musicaDesde: 60,
    cues: [["hielo", 4, -2], ["hielo", 216, -8], ["hielo", 366, -8], ["hielo", 516, -9], ["coctelera", 660, -6], ["hielo", 720, -10]],
  },
};
