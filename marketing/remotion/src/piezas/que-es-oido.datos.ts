// Qué es Oído, en 30 segundos (@oidoapp, 1/12). Guion aprobado en la pestaña Guiones.
// La verificación de identidad es opcional: la pieza no dice que todos están verificados, sino que se ve quién lo está.
import type { Escena, CierreGuion } from "../kit/guion";
import type { DatosTitulo } from "../kit/datos";
import type { Sonido } from "../kit/sonido";
import type { TramoPublicar } from "./tramo-publicar";

const seg = (s: number) => Math.round(s * 30);

export const datos = {
  id: "que-es-oido-30s",
  codigo: "QUE-ES-OIDO",
  titulo: "Qué es Oído, en 30 segundos",
  fecha: "1/12",
  duracion: 30,
  cuenta: "@oidoapp" as const,
  escenas: [
    { desde: 0, hasta: 2.2, lineas: ["Viernes, 19 h.", "Se te cayó un mozo."], dibujo: "salonCel" },
    { desde: 2.2, hasta: 6, lineas: ["Antes: 40 mensajes", "de WhatsApp"], dibujo: "chat40" },
  ] as Escena[],
  /** títulos de la parte con el teléfono (cuadros) */
  titulos: [
    { lineas: ["Con Oído: publicás el", "turno desde el celular"], desde: seg(6), hasta: seg(12) - 8, size: 68, acento: "celular" },
    { lineas: ["Se postula gente del rubro.", "Ves quién tiene la", "identidad verificada."], desde: seg(12), hasta: seg(18) - 8, size: 60, acento: "verificada." },
    { lineas: ["Elegís y listo.", "¡Oído!"], desde: seg(18), hasta: seg(24) - 8, size: 84, acento: "¡Oído!" },
  ] as DatosTitulo[],
  tramo: {
    entra: seg(6), toqueCampo: seg(6) + 22, tipeo: seg(6) + 28, completar: seg(6) + 76, donde: seg(6) + 82, publicar: seg(6) + 136, publicado: seg(6) + 142,
    aviso: seg(12) - 10, candidatos: seg(12) + 8, verificada: [seg(13.6), seg(17.2)], elegir: seg(18) + 10, oido: seg(18) + 16, fin: seg(24),
    aviso_texto: { titulo: "3 postulantes para Mozo/a", texto: "Sofía Ramírez se postuló a tu turno de Mozo/a. Entrá para ver a todos los postulantes y elegir." },
  } as TramoPublicar,
  cierre: { desde: 24, lineas: ["Abre el 12/12 en CABA."], size: 76, logo: "filete", boton: "Comentá CUBRIR", bajada: "y te aviso" } as CierreGuion,
  sonido: {
    murmullo: true, musicaDesde: seg(6),
    cues: [
      ["impresora", 8, -24], ["vibracion", 30, -10], ["toque", 80, -16], ["toque", 96, -16], ["toque", 112, -16], ["toque", 128, -16], ["toque", 144, -16], ["toque", 160, -16],
      ["toque", seg(6) + 22, -4], ["tipeo", seg(6) + 28, -6, 1.5], ["toque", seg(6) + 76, -4], ["toque", seg(6) + 136, -4],
      ["vibracion", seg(12) - 10, -12], ["toque", seg(18) + 10, -4], ["campanita", seg(18) + 30, -2], ["campanita", seg(24) + 6, -5],
    ],
  } as Sonido,
};

export type Datos = typeof datos;
