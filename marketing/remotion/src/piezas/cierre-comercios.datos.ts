// 6 · Cierre para comercios (15 s): el viernes a las 19, tres pasos y el llamado. Sin precios.
import { PAGA, type DatosBase } from "../kit/datos";

export const escenas = { pasos: [66, 150, 234], cierre: 330 };

export const datos = {
  id: "cierre-comercios",
  titulo: "Cierre para comercios",
  duracion: 450,
  cuenta: "@oidoapp",
  paga: PAGA,
  reloj: { hora: "19:00", dia: "VIERNES" },
  titulos: [{ lineas: ["Falta un mozo."], desde: 18, hasta: 56, y: 1000, size: 104 }],
  chips: [],
  pasos: [
    { n: "1", t: ["Escribilo", "como un pedido."], cap: "c-publicar-tipeo-7", y: 300, ty: 1170, hora: "19:01" },
    { n: "2", t: ["Elegí con nota", "y distancia."], cap: "c-recomendados", y: 330, ty: 1170, hora: "19:06" },
    { n: "3", t: ["Mirá cómo", "llega."], cap: "c-camino-1-abajo", y: 440, ty: 1240, hora: "19:38" },
  ],
  cierre: { boton: "Publicá tu turno", bajada: "oido.com.ar", linea2: "¿Dudas? Escribinos por WhatsApp: link en la bio" },
  escenas,
  sonido: {
    murmullo: true,
    cues: [
      ["toque", 0, -16], ["toque", 6, -16], ["toque", 12, -16], ["toque", 18, -16], ["toque", 24, -16], ["toque", 30, -16], ["toque", 36, -16],
      ["toque", 42, -16], ["toque", 48, -16], ["vibracion", 18, -12], ["impresora", 66, -20], ["toque", 150, -8], ["toque", 234, -8], ["campanita", 336, -3],
    ],
  },
} satisfies DatosBase & Record<string, unknown>;

export type Datos = typeof datos;
